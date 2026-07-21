# Go-Live Sign-off Register — Jojan One

_Updated 2026-07-19._

The single tracking artifact for launch assurance. Each gate has an **owner**, a
**status**, the **evidence** that closes it, and what is **blocking**. Launch
exit = every gate `Done` or an explicit, dated risk acceptance by the owner.

**Status key:** ✅ Done · 🟡 In progress · 🟥 Blocked / not started · ⏭️ Risk-accepted (dated)

This register is deliberately honest about the line between what is **built in
the codebase** (which the team controls) and what needs an **external party or
production infrastructure** (pen-test firm, PITR drill on infra, signed DPAs).
Code being complete does not tick a gate that also needs an operational action.

---

## 1. Application & quality

| Gate | Owner | Status | Evidence / how it closes |
|---|---|---|---|
| Production build green | Eng | ✅ | `next build` — all routes compile; typecheck + prettier clean in CI. |
| Tenant isolation proven | Eng | ✅ | 24 `verify-*` scripts run real 2-tenant CRUD + RLS against hosted Supabase (`npm run verify:isolation`). |
| CI gates | Eng | ✅ | format · typecheck · `adminDb`-in-`app/` guard · build · isolation verify. |
| Accessibility baseline | Eng | ✅ | Skip link, focus rings, aria labels, keyboard-reachable controls, semantic tables. |
| Full WCAG 2.1 AA audit (screen reader) | Eng + a11y reviewer | 🟥 | Formal pass with NVDA/VoiceOver across each module; log + fix findings. Baseline done; formal audit open. |
| Load test hot read paths | Eng | 🟥 | k6/Artillery against dashboard, Jova, reports export at target concurrency; record p95 latency + error rate. |

## 2. Security

| Gate | Owner | Status | Evidence / how it closes |
|---|---|---|---|
| Rate limiting on sensitive `/api/*` | Eng | 🟡 | **Code shipped** — `enforceRateLimit` on invite, invite-accept, member management, ownership transfer, Jova ask (`src/server/security/rate-limit.ts`, `verify-ratelimit.ts` 9/9). **To close:** set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in prod for distributed enforcement (in-memory until then). `/api/health` → `rate_limit`. |
| CDN / WAF in front of `/api/*` | Infra | 🟥 | Managed WAF (Cloudflare/Vercel) with sane bot + rate rules; confirm `x-forwarded-for` reaches the app for keying. |
| Independent security review / pen-test | Security vendor | 🟥 | Engagement scoped to auth, RLS tenant isolation, impersonation flow, Stripe webhook, file storage. Remediate criticals before launch. |
| Threat model signed off | Eng lead | 🟡 | `docs/07-Security-Threat-Model.md` reviewed and dated by the eng lead. |
| Secrets in platform store, rotated | Infra | 🟥 | No secret lives in `.env.local` in prod; rotate any key that ever touched a local file. |
| Storage bucket object policies confirmed | Eng | 🟥 | Evidence-bucket RLS/object policies verified on the hosted project (owner-scoped read/write only). |

## 3. Privacy & legal

| Gate | Owner | Status | Evidence / how it closes |
|---|---|---|---|
| DPIA signed off | DPO | 🟡 | `docs/08-Privacy-and-DPIA.md` reviewed, residual risks accepted, dated. |
| DPAs executed with sub-processors | Legal | 🟥 | Signed DPAs: Supabase, Stripe, email provider, AI provider (if enabled), Companies House data use reviewed. |
| Privacy policy + cookie notice published | Legal | 🟥 | Public URLs live; linked from footer + sign-up. |
| Data-subject request runbook | DPO | 🟡 | Export/erasure path documented (see privacy doc); test one end-to-end. |

## 4. Infrastructure & resilience

| Gate | Owner | Status | Evidence / how it closes |
|---|---|---|---|
| Staging / production split | Infra | 🟥 | Separate Supabase projects; prod migrations applied from version control only. |
| PITR restore drill (RTO/RPO recorded) | Infra | 🟥 | Restore to a throwaway project at a timestamp; verify counts + policies + `verify-*`; record RTO/RPO (runbook in doc 09). **An untested backup is not a backup.** |
| `pg_cron` reminder job scheduled | Infra | 🟥 | Job scheduled; first run confirmed; `/api/health` → `cron` ok. |
| Uptime monitor on `/api/health` | Infra | 🟥 | Alert on non-200 or `database: error`. |
| Structured logging + dashboards | Infra | 🟥 | Request id, workspace id, latency, status; dashboards for auth/webhook/cron failures, AI refusals, 5xx. |

## 5. Commercial integrations (build-now, keys-later)

| Gate | Owner | Status | Evidence / how it closes |
|---|---|---|---|
| Stripe live keys + webhook | Eng | 🟥 | Live-mode keys; webhook endpoint registered; a real test purchase + Customer Portal round-trip; `/api/health` → `stripe`/`stripe_webhook` ok. |
| AI provider live key | Eng | 🟥 | `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` set + smoke test; degrades to deterministic engine until then. |
| Companies House live key | Eng | 🟥 | Key set + a real lookup smoke-tested; serves stale cache + flags it until then. |
| Email domain verified (SPF/DKIM) | Infra | 🟥 | Domain verified; a real invite + reminder delivered; `/api/health` → `email` ok. |

## 6. Support & operations

| Gate | Owner | Status | Evidence / how it closes |
|---|---|---|---|
| Support inbox + escalation path | Ops | 🟥 | Inbox live; runbooks (doc 09) linked from the on-call doc. |
| Status page / incident comms | Ops | 🟥 | Status page + a written incident comms plan. |

---

## Launch decision

Sign-off requires the named owner of every 🟥/🟡 gate to either move it to ✅ or
record a dated ⏭️ risk acceptance here, with docs 07 and 08 signed off and the
PITR restore drill recorded.

| Role | Name | Decision | Date |
|---|---|---|---|
| Engineering lead | | | |
| Security | | | |
| DPO / Privacy | | | |
| Product owner | | | |
