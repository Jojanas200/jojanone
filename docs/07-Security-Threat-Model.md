# Security Review & Threat Model — Jojan One

_Updated 2026-07-18. Owner: engineering. Review cadence: quarterly + on any auth/tenancy change._

This is a living document for M6 (Launch assurance). It records the trust boundaries, the threats we designed against, the controls in place, and the items that still need a human sign-off before go-live.

## 1. Assets

| Asset | Sensitivity | Store |
|---|---|---|
| Tenant business data (contracts, risk, HR, GDPR, obligations, evidence) | High — commercially sensitive, some special-category | Postgres (RLS) |
| Auth identities & sessions | High | Supabase Auth (cookie sessions via `@supabase/ssr`) |
| Evidence documents | High | Private `evidence` Storage bucket (path = `workspace_id/…`) |
| Billing state | Medium | `subscriptions` (webhook-authoritative) |
| Secrets (DB password, service-role key, Stripe/CH/AI/email keys, CRON_SECRET) | Critical | `.env.local` / deployment secret store — never in the repo, never echoed |

## 2. Trust boundaries

```
Browser ──cookies──▶ Next.js (middleware auth) ──▶ Route Handlers ──withUser()──▶ Postgres RLS
                                                  └──adminDb (service role)──▶ Postgres (RLS bypassed)
External: Stripe webhook, pg_cron → /api/cron/*, Companies House API, AI provider, email provider
```

- **Primary isolation control: Postgres Row-Level Security.** Every user-request query runs through `withUser(claims, …)`, which sets `request.jwt.claims` + `role authenticated` inside the transaction so `auth.uid()` drives every policy. Tenant isolation is enforced by the database, not by application `where` clauses.
- **`adminDb` (service role) bypasses RLS** and is reserved for webhooks, the cron job, public-reference caches, and provisioning. A **CI guard forbids `adminDb` under `app/`** so it can never enter a user-request path unscoped.

## 3. Threats & controls (STRIDE-ish)

| Threat | Vector | Control | Verified by |
|---|---|---|---|
| **Cross-tenant read/write** | User A queries/edits B's rows | RLS on all 50+ tenant tables; every service uses `withUser` | **19 `verify-*` scripts** exercise real 2-user CRUD + isolation |
| **Privilege escalation** | Non-owner performs owner actions | `has_workspace_role(..., ['owner_admin'])` on billing/invite/subscription writes; route-level role checks | `verify-billing` (owner-gated), invite verifier |
| **AI cross-tenant leakage / prompt injection** | Hostile prompt asks for other tenants' data | Retrieval is RLS-bounded **before** the model sees anything; model can't reach data RLS didn't return | `verify-jova-ai` (access-isolation + injection evals) |
| **Webhook forgery** | Fake Stripe events flip plan state | `stripe.webhooks.constructEvent` signature check; idempotent on unique `stripe_event_id` | `verify-billing` (idempotency), signature path |
| **Cron abuse** | Anyone triggers the reminder job | `POST /api/cron/*` gated by `CRON_SECRET` bearer | route guard |
| **Secret exposure** | Secrets in repo/logs/responses | `.gitignore` on `.env.local`; health endpoint returns booleans only; CI never prints env | manual + `/api/health` design |
| **Spoofed operator instructions** | Injected "system" text in user input | Model system prompt is server-built; user content never elevated | eval suite |
| **Invitation abuse** | Guessing/replaying invite tokens | Raw token never stored (`token_hash` only); single-use; expiry; email-bound acceptance | invite verifier |
| **Session theft** | Stolen cookie | Supabase `@supabase/ssr` httpOnly cookies; middleware refresh; short-lived access tokens | Supabase-managed |
| **DoS / cost abuse** | Flooding AI/CH endpoints | Auth required; CH cached per workspace w/ TTL; AI gated by config | partial — rate limiting is an open item (§5) |

## 4. Data protection

- **Region:** London (`eu-west-2`) Supabase project — UK data residency.
- **Special-category data** (health, etc. in HR/GDPR modules) lives under the same RLS; GDPR module tracks lawful basis + review dates; Jova flags unreviewed special-category processing.
- **Encryption:** at rest (Supabase-managed) and in transit (TLS). Evidence bucket is private with object RLS keyed on `workspace_id`.
- **Deletion/retention:** soft-delete on register modules (retention/audit); workspace delete cascades. A documented data-subject-request procedure is an open item (§5).

## 5. Open items before go-live (need human/tooling)

- [ ] Independent security review / pen-test of the deployed environment.
- [ ] Rate limiting / WAF in front of `/api/*` (per-IP + per-user) — not yet implemented in app code.
- [ ] Secret management in production (move off `.env.local` to the platform secret store; rotate the keys that were ever in a local file).
- [ ] Verify the Storage evidence-bucket object policies on the hosted project (created via guarded DO blocks; confirm they applied).
- [ ] PITR **restore drill** — see [09-Runbooks-and-Go-Live.md](./09-Runbooks-and-Go-Live.md).
- [ ] Formal DPIA sign-off — see [08-Privacy-and-DPIA.md](./08-Privacy-and-DPIA.md).
- [ ] Dependency audit (`npm audit`) triage — currently non-zero, mostly in the dormant TanStack/Vite chain; confirm none reach the Next.js runtime path.
