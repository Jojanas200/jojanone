import { NextResponse } from "next/server";
import { getStripe } from "@/server/services/stripe";
import {
  processStripeEvent,
  type StripeEventLike,
} from "@/server/services/billing-webhook";

// Stripe sends the raw body; we must verify the signature against it before
// trusting anything. Never parse the body first.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 },
    );

  const sig = req.headers.get("stripe-signature");
  if (!sig)
    return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text();

  let event: StripeEventLike;
  try {
    event = getStripe().webhooks.constructEvent(
      raw,
      sig,
      secret,
    ) as unknown as StripeEventLike;
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // Return 500 so Stripe retries transient failures.
    return NextResponse.json(
      { error: `processing failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
