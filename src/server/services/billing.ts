import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { withUser, type UserClaims, type Tx } from "../db";
import { memberships, plans, subscriptions } from "../db/schema";

// Billing read model. Subscription state is the single source of truth (written
// only by verified Stripe webhooks); this module reads it and derives seat
// usage. Gating is SEATS ONLY - every feature works on every tier - so there is
// no feature-paywall logic here by design (safety notices, exports and
// professional-support escalation are never gated).

export interface PlanRow {
  key: string;
  name: string;
  priceMinor: number | null;
  currency: string;
  seatLimit: number | null;
  isSellable: boolean;
  sortOrder: number;
}

export interface BillingOverview {
  planKey: string;
  planName: string;
  status: string;
  priceMinor: number | null;
  currency: string;
  seatsAllowed: number;
  seatsUsed: number;
  seatsAvailable: number;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  hasStripeCustomer: boolean;
}

/** Count active memberships (non-expired) - the seats in use. */
function seatsUsedQuery(tx: Tx, workspaceId: string) {
  return tx
    .select({ n: sql<number>`count(*)` })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        or(
          isNull(memberships.expiresAt),
          gt(memberships.expiresAt, sql`now()`),
        ),
      ),
    );
}

export function listSellablePlans(claims: UserClaims): Promise<PlanRow[]> {
  return withUser(claims, (tx) =>
    tx
      .select({
        key: plans.key,
        name: plans.name,
        priceMinor: plans.priceMinor,
        currency: plans.currency,
        seatLimit: plans.seatLimit,
        isSellable: plans.isSellable,
        sortOrder: plans.sortOrder,
      })
      .from(plans)
      .orderBy(asc(plans.sortOrder)),
  );
}

export function getBillingOverview(
  claims: UserClaims,
  workspaceId: string,
): Promise<BillingOverview | null> {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({
        planKey: subscriptions.planKey,
        planName: plans.name,
        priceMinor: plans.priceMinor,
        currency: plans.currency,
        status: subscriptions.status,
        seatsAllowed: subscriptions.seatsAllowed,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAt: subscriptions.cancelAt,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.key, subscriptions.planKey))
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);
    const sub = rows[0];
    if (!sub) return null;

    const used = Number((await seatsUsedQuery(tx, workspaceId))[0]?.n ?? 0);
    return {
      planKey: sub.planKey,
      planName: sub.planName,
      status: sub.status,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
      seatsAllowed: sub.seatsAllowed,
      seatsUsed: used,
      seatsAvailable: Math.max(0, sub.seatsAllowed - used),
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAt: sub.cancelAt,
      hasStripeCustomer: !!sub.stripeCustomerId,
    };
  });
}

/** True if the workspace has a free seat (used < allowed). */
export async function hasSeatAvailable(
  claims: UserClaims,
  workspaceId: string,
): Promise<boolean> {
  const overview = await getBillingOverview(claims, workspaceId);
  return !!overview && overview.seatsAvailable > 0;
}
