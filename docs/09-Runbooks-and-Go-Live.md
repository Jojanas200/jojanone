# Runbooks & Go-Live Checklist — Jojan One

_Updated 2026-07-18. M6 operational readiness._

## Observability

- **Health probe:** `GET /api/health` → `{status, checks}` (DB round-trip + which integrations are configured, booleans only). Wire an uptime monitor to it; alert on non-200 or `database: error`. Returns 503 when the DB is unreachable.
- **Structured errors:** Route Handlers return a typed error envelope (`{error, …}`) with correct status codes; the AI and billing session layers degrade instead of 500-ing (deterministic fallback / typed 503/400).
- **Recommended before launch:** ship logs to a provider (request id, workspace id, latency, status); dashboards for auth failures, webhook failures, cron runs, AI refusals/escalations, and 5xx rate.

## Runbook: Stripe webhook failures

1. Check Stripe Dashboard → Developers → Webhooks for delivery errors.
2. `/api/health` → `stripe_webhook` must be `ok` (secret configured).
3. Events are **idempotent** on `stripe_event_id` — safe to replay from Stripe.
4. If subscription state looks wrong, re-send the latest `customer.subscription.updated` from Stripe; the webhook re-derives canonical state.

## Runbook: reminder cron

- Trigger: `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`.
- Schedule via Supabase `pg_cron` + `net.http_post` (snippet in the route header comment) or any external scheduler.
- Idempotent: one active reminder per source item — safe to run repeatedly.
- If emails aren't sending, `/api/health` → `email` should be `ok`; otherwise the digest is skipped (in-app notifications still generate).

## Runbook: Companies House / AI provider outage

- Both are **build-now-key-later** and degrade gracefully: CH serves stale cache and flags it; AI falls back to the deterministic findings engine. No customer-facing hard failure.
- Rotate keys via the deployment secret store; `/api/health` reflects configuration.

## Runbook: PITR restore drill (REQUIRED before launch)

Supabase provides Point-in-Time Recovery. **Drill it before go-live — an untested backup is not a backup.**

1. In the Supabase dashboard, note the PITR window and the most recent recovery point.
2. Restore to a **throwaway project** at a chosen timestamp (never overwrite production during a drill).
3. Verify: table counts, RLS policies present (`select count(*) from pg_policies`), a spot-check that `provision_workspace` and a couple of `verify-*` scripts pass against the restored DB.
4. Record RTO (time to restore) and RPO (data-loss window) in this doc.
5. Tear down the throwaway project.

_Result of last drill: **not yet run** — blocking go-live._

## Go-Live Checklist

### Infrastructure
- [ ] Separate **staging** and **production** Supabase projects (currently one hosted project).
- [ ] Production secrets in the platform secret store (not `.env.local`); rotate any key that ever lived in a local file.
- [ ] `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, and all integration keys set in prod.
- [ ] `pg_cron` reminder job scheduled and its first run confirmed.
- [ ] PITR restore drill completed; RTO/RPO recorded.

### Application
- [x] Production build green (49/49 routes); typecheck + prettier clean.
- [x] Tenant isolation proven by 19+ `verify-*` scripts against real Supabase.
- [x] CI: format · typecheck · adminDb-in-`app/` guard · build · isolation verify.
- [x] Accessibility baseline (skip link, focus rings, aria, keyboard-reachable controls, semantic tables).
- [ ] Full WCAG 2.1 AA audit with a screen reader (baseline done; formal audit is open).
- [ ] Load test the hot read paths (dashboard, Jova, reports export).

### Security & Privacy (see docs 07 & 08)
- [ ] Independent security review / pen-test.
- [~] Rate limiting on sensitive `/api/*` routes: **code shipped** (invite, invite-accept, member management, ownership transfer, Jova ask). Distributed enforcement is keys-later — set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for cross-instance limits (until then it is in-memory best-effort). A CDN/WAF in front of `/api/*` is still recommended.
- [ ] DPAs executed; privacy policy published; DPIA signed off.
- [ ] Storage evidence-bucket object policies confirmed on the hosted project.

_Full sign-off tracking: see [10-Go-Live-Signoff-Register.md](10-Go-Live-Signoff-Register.md)._

### Commercial
- [ ] Stripe live-mode keys + webhook endpoint registered; a real test purchase + Customer Portal round-trip.
- [ ] Companies House and AI-provider live keys added and smoke-tested.
- [ ] Email provider domain verified (SPF/DKIM) and a real invite + reminder delivered.

### Support
- [ ] Support inbox + escalation path; these runbooks linked from the on-call doc.
- [ ] Status page / incident comms plan.

**Exit:** every box ticked, docs 07/08 signed off, restore drill recorded.
