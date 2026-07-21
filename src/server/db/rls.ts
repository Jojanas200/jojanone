import { sql } from "drizzle-orm";
import { db, type Tx } from "./client";

export interface UserClaims {
  /** Supabase auth user id - becomes auth.uid() inside the transaction. */
  sub: string;
  /** Postgres/JWT role. Always 'authenticated' for signed-in users. */
  role?: string;
  /** Any additional JWT claims to expose to policies (optional). */
  [claim: string]: unknown;
}

/**
 * Run `fn` AS THE END USER with Row-Level Security ENFORCED.
 *
 * This mirrors exactly what PostgREST does for supabase-js: for the duration of
 * one transaction it sets `request.jwt.claims` and switches to role
 * `authenticated`, so `auth.uid()` = claims.sub and every RLS policy applies.
 * `set local` scopes both to the transaction, so nothing leaks between requests.
 *
 * Use this for ALL user-request-path queries. Never reach for `adminDb` there.
 *
 * @example
 *   const rows = await withUser({ sub: user.id }, (tx) =>
 *     tx.select().from(contracts));   // only the user's workspace rows come back
 */
export async function withUser<T>(
  claims: UserClaims,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const payload = JSON.stringify({ role: "authenticated", ...claims });
  return db.transaction(async (tx) => {
    // Order matters: set the claims while still privileged, THEN drop role.
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${payload}, true)`,
    );
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
