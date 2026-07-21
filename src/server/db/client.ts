import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The single privileged Postgres connection for the app.
 *
 * The security boundary is the CODE PATH, not the connection:
 *   - queries run inside `withUser()` (see ./rls) execute as role `authenticated`
 *     with the caller's JWT claims → RLS is ENFORCED in Postgres.
 *   - queries run directly on `adminDb` (see ./admin) run as the connecting
 *     owner/service role → RLS is BYPASSED (trusted server work only).
 *
 * `prepare: false` is required behind Supabase's transaction pooler (port 6543).
 * Locally, point DATABASE_URL at the Supabase DB (port 54322).
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set - see .env.example");
}

export const sqlClient = postgres(url, { prepare: false });

export const db = drizzle(sqlClient, { schema });

export type Db = typeof db;

/** Transaction handle type, derived from db.transaction's callback. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
