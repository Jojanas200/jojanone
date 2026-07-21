import { eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { billingEvents, plans, subscriptions } from "../db/schema";
import { planForPriceId } from "./stripe";

// Stripe webhook processing. Verified events (signature checked in the route)
// are turned into canonical subscription state here. Idempotent on the unique
// stripe_event_id: a replayed event is recorded once and never re-applied.
// All writes use adminDb (webhooks have no user session).

// A minimal structural view of the events we handle (works with real
// Stripe.Event objects and synthetic test events alike).
export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface ProcessResult {
  processed: boolean;
  action: string;
  workspaceId?: string | null;
}

const toDate = (secs: unknown): Date | null =>
  typeof secs === "number" ? new Date(secs * 1000) : null;

async function seatsForPlan(planKey: string): Promise<number> {
  const row = (
    await adminDb
      .select({ seatLimit: plans.seatLimit })
      .from(plans)
      .where(eq(plans.key, planKey))
      .limit(1)
  )[0];
  return row?.seatLimit ?? 1;
}

async function findWorkspaceByCustomer(
  customerId: string | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  const row = (
    await adminDb
      .select({ workspaceId: subscriptions.workspaceId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1)
  )[0];
  return row?.workspaceId ?? null;
}

// Resolve the plan key + seats for a subscription object (metadata first,
// then price → plan mapping).
function planFromSubscription(obj: Record<string, unknown>): string | null {
  const md = (obj.metadata ?? {}) as Record<string, unknown>;
  if (typeof md.plan_key === "string") return md.plan_key;
  const items = obj.items as
    { data?: Array<{ price?: { id?: string } }> } | undefined;
  return planForPriceId(items?.data?.[0]?.price?.id);
}

async function applySubscriptionState(
  workspaceId: string,
  obj: Record<string, unknown>,
  fallbackStatus?: string,
) {
  const planKey = planFromSubscription(obj);
  const patch: Record<string, unknown> = {
    status: (obj.status as string) ?? fallbackStatus ?? "active",
    stripeSubscriptionId: (obj.id as string) ?? null,
    currentPeriodEnd: toDate(obj.current_period_end),
    cancelAt: toDate(obj.cancel_at),
    updatedAt: new Date(),
  };
  if (typeof obj.customer === "string") patch.stripeCustomerId = obj.customer;
  if (planKey) {
    patch.planKey = planKey;
    patch.seatsAllowed = await seatsForPlan(planKey);
  }
  await adminDb
    .update(subscriptions)
    .set(patch)
    .where(eq(subscriptions.workspaceId, workspaceId));
}

export async function processStripeEvent(
  event: StripeEventLike,
): Promise<ProcessResult> {
  // Idempotency gate: record the event id once. A duplicate insert is skipped.
  const recorded = await adminDb
    .insert(billingEvents)
    .values({
      stripeEventId: event.id,
      type: event.type,
      payload: event as unknown as object,
    })
    .onConflictDoNothing({ target: billingEvents.stripeEventId })
    .returning({ id: billingEvents.id });
  if (recorded.length === 0) return { processed: false, action: "duplicate" };

  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const workspaceId =
        (obj.client_reference_id as string) ??
        ((obj.metadata as Record<string, unknown>)?.workspace_id as string) ??
        null;
      if (!workspaceId) return { processed: true, action: "no-workspace" };
      const planKey =
        ((obj.metadata as Record<string, unknown>)?.plan_key as string) ??
        "starter";
      const patch: Record<string, unknown> = {
        status: "active",
        planKey,
        seatsAllowed: await seatsForPlan(planKey),
        updatedAt: new Date(),
      };
      if (typeof obj.customer === "string")
        patch.stripeCustomerId = obj.customer;
      if (typeof obj.subscription === "string")
        patch.stripeSubscriptionId = obj.subscription;
      await adminDb
        .update(subscriptions)
        .set(patch)
        .where(eq(subscriptions.workspaceId, workspaceId));
      return { processed: true, action: "checkout-completed", workspaceId };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const workspaceId =
        ((obj.metadata as Record<string, unknown>)?.workspace_id as string) ??
        (await findWorkspaceByCustomer(obj.customer as string));
      if (!workspaceId) return { processed: true, action: "no-workspace" };
      await applySubscriptionState(workspaceId, obj);
      return { processed: true, action: "subscription-updated", workspaceId };
    }

    case "customer.subscription.deleted": {
      const workspaceId =
        ((obj.metadata as Record<string, unknown>)?.workspace_id as string) ??
        (await findWorkspaceByCustomer(obj.customer as string));
      if (!workspaceId) return { processed: true, action: "no-workspace" };
      await adminDb
        .update(subscriptions)
        .set({
          status: "canceled",
          cancelAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      return { processed: true, action: "subscription-canceled", workspaceId };
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const workspaceId = await findWorkspaceByCustomer(obj.customer as string);
      if (workspaceId)
        await adminDb
          .update(subscriptions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(subscriptions.workspaceId, workspaceId));
      return { processed: true, action: "invoice-paid", workspaceId };
    }

    case "invoice.payment_failed": {
      const workspaceId = await findWorkspaceByCustomer(obj.customer as string);
      if (workspaceId)
        await adminDb
          .update(subscriptions)
          .set({ status: "past_due", updatedAt: new Date() })
          .where(eq(subscriptions.workspaceId, workspaceId));
      return { processed: true, action: "payment-failed", workspaceId };
    }

    default:
      return { processed: true, action: "ignored" };
  }
}
