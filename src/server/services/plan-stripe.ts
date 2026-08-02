import { getStripe, isStripeConfigured } from "./stripe";

// Keeps a package's Stripe objects in step with what the admin designed.
//
// Stripe Prices are immutable, so a price change means creating a NEW price and
// deactivating the old one. Existing subscribers stay on the price they signed
// up to until they are migrated - which is Stripe's intended behaviour and the
// reason we never mutate a live price in place.

export interface PlanPricingInput {
  key: string;
  name: string;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  billingInterval: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
}

export interface StripeSyncResult {
  synced: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  /** Set when the sync could not run or failed - surfaced in the admin UI. */
  warning: string | null;
}

const isPaid = (priceMinor: number | null) =>
  typeof priceMinor === "number" && priceMinor > 0;

/**
 * Ensure Stripe holds a product and an active price matching this package.
 * Never throws: a Stripe outage must not stop an admin saving their work, so
 * failures come back as a warning and the package saves unsynced.
 */
export async function syncPlanToStripe(
  plan: PlanPricingInput,
  opts?: { previousPriceMinor?: number | null; previousInterval?: string },
): Promise<StripeSyncResult> {
  if (!isPaid(plan.priceMinor))
    return {
      synced: false,
      stripeProductId: plan.stripeProductId,
      stripePriceId: null,
      warning: null, // free packages need no Stripe price
    };

  if (!isStripeConfigured())
    return {
      synced: false,
      stripeProductId: plan.stripeProductId,
      stripePriceId: plan.stripePriceId,
      warning:
        "Stripe is not connected, so this price has not been published to Stripe. Set STRIPE_SECRET_KEY and save again.",
    };

  try {
    const stripe = getStripe();

    // 1. Product - created once, then kept in step.
    let productId = plan.stripeProductId;
    if (productId) {
      await stripe.products.update(productId, {
        name: plan.name,
        ...(plan.description ? { description: plan.description } : {}),
      });
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        ...(plan.description ? { description: plan.description } : {}),
        metadata: { plan_key: plan.key },
      });
      productId = product.id;
    }

    // 2. Price - reuse when nothing pricing-related changed.
    const unchanged =
      !!plan.stripePriceId &&
      opts?.previousPriceMinor === plan.priceMinor &&
      (opts?.previousInterval ?? plan.billingInterval) === plan.billingInterval;
    if (unchanged)
      return {
        synced: true,
        stripeProductId: productId,
        stripePriceId: plan.stripePriceId,
        warning: null,
      };

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.priceMinor as number,
      currency: plan.currency.toLowerCase(),
      recurring: {
        interval: plan.billingInterval === "year" ? "year" : "month",
      },
      metadata: { plan_key: plan.key },
    });

    // 3. Retire the superseded price so it can no longer be sold.
    if (plan.stripePriceId && plan.stripePriceId !== price.id) {
      try {
        await stripe.prices.update(plan.stripePriceId, { active: false });
      } catch {
        // An already-archived or missing price is not a failure.
      }
    }

    return {
      synced: true,
      stripeProductId: productId,
      stripePriceId: price.id,
      warning: null,
    };
  } catch (err) {
    return {
      synced: false,
      stripeProductId: plan.stripeProductId,
      stripePriceId: plan.stripePriceId,
      warning: `Stripe rejected the change: ${(err as Error).message}. The package is saved but not published to Stripe.`,
    };
  }
}
