import Stripe from "stripe";

// Lazy Stripe client. Billing is build-now-key-later: without STRIPE_SECRET_KEY
// the app runs normally and billing actions report "not connected". Price IDs
// map plan keys → Stripe prices via env, so no code change is needed to go live.

let client: Stripe | null = null;

export const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  if (!client) client = new Stripe(key);
  return client;
}

// Map a plan key to its configured Stripe price id.
export function priceIdForPlan(planKey: string): string | null {
  const env: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
  };
  return env[planKey] ?? null;
}

// Reverse of priceIdForPlan: map a Stripe price id back to a plan key.
export function planForPriceId(
  priceId: string | null | undefined,
): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return "growth";
  return null;
}

export const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
