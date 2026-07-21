import type { UserClaims } from "../db";

export interface AuthedUser {
  sub: string;
  email?: string;
}

/**
 * Verify a Supabase access token and return the user, or null if invalid.
 *
 * Route Handlers call this to turn the request's session/bearer token into a
 * trusted `sub`, which is then passed to `withUser()` for RLS-scoped queries.
 * (Uses Supabase's /auth/v1/user endpoint so we don't hand-roll JWT verification;
 * a Route Handler can also read the session directly from @supabase/ssr cookies.)
 */
export async function verifyAccessToken(
  accessToken: string,
): Promise<AuthedUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon)
    throw new Error(
      "Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)",
    );

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) return null;
  return { sub: user.id, email: user.email };
}

/** Build the RLS claims object passed to withUser() from a verified user. */
export function claimsFor(user: AuthedUser): UserClaims {
  return { sub: user.sub, role: "authenticated" };
}
