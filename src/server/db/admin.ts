import { db } from "./client";

/**
 * adminDb - RLS is BYPASSED.
 *
 * Queries run as the connecting Postgres role (the table owner / service role),
 * which is not subject to RLS. That means adminDb can read and write ANY
 * workspace's data.
 *
 * Use it ONLY in trusted server code that has no single "current user":
 *   - Stripe / provider webhooks
 *   - scheduled jobs (Edge Functions + pg_cron): reminders, digests, CH refresh
 *   - admin / migration / reconciliation tasks
 *   - writing audit_events and notifications on the user's behalf
 *
 * NEVER use adminDb to serve a user request - use withUser() from ./rls so the
 * database enforces tenant isolation. A single misuse is a cross-tenant leak.
 */
export const adminDb = db;
