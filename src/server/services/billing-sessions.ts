import { eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { subscriptions } from "../db/schema";
import {
  appUrl,
  getStripe,
  isStripeConfigured,
  priceIdForPlan,
} from "./stripe";

// Checkout + Customer Portal session creation. These read/write the canonical
// stripe_customer_id via adminDb (service role) - they run in owner-gated route
// handlers that authorise the workspace first.

export type BillingSessionResult =
  { ok: true; url: string } | { ok: false; code: 503 | 400; error: string };

export async function createCheckoutSession(
  workspaceId: string,
  planKey: string,
  userEmail: string | null,
): Promise<BillingSessionResult> {
  if (!isStripeConfigured())
    return { ok: false, code: 503, error: "Billing is not connected yet." };

  const price = priceIdForPlan(planKey);
  if (!price)
    return {
      ok: false,
      code: 400,
      error: `No Stripe price configured for the ${planKey} plan.`,
    };

  const sub = (
    await adminDb
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1)
  )[0];

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: workspaceId,
    ...(sub?.customerId
      ? { customer: sub.customerId }
      : userEmail
        ? { customer_email: userEmail }
        : {}),
    subscription_data: { metadata: { workspace_id: workspaceId } },
    metadata: { workspace_id: workspaceId, plan_key: planKey },
    success_url: `${appUrl()}/billing?status=success`,
    cancel_url: `${appUrl()}/billing?status=cancelled`,
    allow_promotion_codes: true,
  });

  if (!session.url)
    return { ok: false, code: 400, error: "Could not start checkout." };
  return { ok: true, url: session.url };
}

export async function createPortalSession(
  workspaceId: string,
): Promise<BillingSessionResult> {
  if (!isStripeConfigured())
    return { ok: false, code: 503, error: "Billing is not connected yet." };

  const sub = (
    await adminDb
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1)
  )[0];

  if (!sub?.customerId)
    return {
      ok: false,
      code: 400,
      error: "No billing account yet - subscribe first.",
    };

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.customerId,
    return_url: `${appUrl()}/billing`,
  });
  return { ok: true, url: session.url };
}
