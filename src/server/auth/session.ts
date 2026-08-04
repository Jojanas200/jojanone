import { createClient } from "@/lib/supabase/server";
import type { UserClaims } from "@/server/db";

/**
 * Resolve the current request's user into RLS claims, or null if not signed in.
 * Reads the Supabase session from cookies (Server Components / Route Handlers),
 * then hands `{ sub }` to withUser() so Postgres RLS runs as this user.
 */
export async function getClaims(): Promise<UserClaims | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { sub: user.id, role: "authenticated" } : null;
}

/** Like getClaims, but also returns the user's email (for Stripe Checkout). */
export async function getSessionUser(): Promise<{
  sub: string;
  email: string | null;
  fullName: string | null;
  /** The package chosen on the pricing page, stamped at sign-up. Survives the
   *  email confirmation round trip, which a query string does not. */
  intendedPlan: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  return {
    sub: user.id,
    email: user.email ?? null,
    fullName: str(meta?.full_name),
    intendedPlan: str(meta?.intended_plan),
  };
}
