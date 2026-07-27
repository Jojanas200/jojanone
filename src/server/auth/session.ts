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
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const rawName = (user.user_metadata as Record<string, unknown> | undefined)
    ?.full_name;
  return {
    sub: user.id,
    email: user.email ?? null,
    fullName:
      typeof rawName === "string" && rawName.trim() ? rawName.trim() : null,
  };
}
