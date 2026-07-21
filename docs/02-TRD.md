# 02 — Technical Requirements Document (TRD)

**Product:** Jojan One · **Companion docs:** [PRD](./01-PRD.md), [Stack Decision](./00-Stack-Decision.md), [Schema](./05-Backend-Schema.md)

---

## 1. Architecture overview

```
                         ┌─────────────────────────────────────────────┐
                         │        Next.js app (Vercel) — one deploy    │
                         │  UI: App Router · React 19 · shadcn/ui      │
                         │  API: Route Handlers (app/api/*, Node)      │
                         │   • session from @supabase/ssr cookies      │
                         │   • Drizzle withUser() (role=authenticated) │──► RLS enforced in DB
                         │   • Drizzle adminDb (service role → jobs)   │
                         │   • Zod validation · idempotency · audit    │
                         │   • Jova (deterministic + provider adapter) │
                         └───┬───────┬───────┬───────┬───────┬──────────┘
                             │       │       │       │       │
        ┌────────────────────▼┐  ┌───▼────┐ ┌▼──────┐│  ┌────▼──────────────────────┐
        │   Supabase Auth     │  │Supabase│ │Supabase││  │  Third-party integrations │
        │ (sessions, MFA,     │  │Postgres│ │Storage ││  │  Stripe · Companies House │
        │  recovery)          │  │(London)│ │(private││  │  Email (Resend/Postmark)  │
        └─────────────────────┘  │ RLS +  │ │buckets)││  │  AI: Anthropic|OpenRouter │
                                 │triggers│ └────────┘│  └───────────────────────────┘
                                 └────────┘           │
   Supabase Edge Functions + pg_cron ──► scheduled jobs (reminders, reports, CH refresh)
```

**Principles**

- **RLS-first:** every tenant-owned row carries `workspace_id`; Postgres policies are the
  single source of truth for isolation. Route Handlers query **as the user** via Drizzle's
  `withUser()` wrapper (transaction sets `request.jwt.claims` + `role = authenticated`), so
  RLS still executes in the database on every query — app code never assumes it's the only
  guard.
- **`adminDb` (service role, RLS bypassed) stays server-side** for trusted work only
  (webhooks, cron jobs, migrations, audit writes). The browser never holds a Supabase key.
- **Idempotent server mutations** for anything money- or webhook-driven.
- **Everything auditable:** important mutations write an append-only `audit_events` row.
- *Express is the drop-in alternative to Route Handlers if the API is later decoupled from
  the UI — same clients, same RLS pattern (see [Stack Decision](./00-Stack-Decision.md)).*

## 2. Frontend

- **Next.js 15 App Router**, React 19, TypeScript strict mode.
- **UI system:** Tailwind CSS 4 + shadcn/ui (Radix). Reuse the prototype's components,
  brand tokens and Jova visual language (see [UI/UX](./03-UI-UX-Design.md)).
- **Data fetching:** Server Components / Route Handlers for initial loads; TanStack Query for
  client-side caching/mutations against the app's own **Route Handlers** (`app/api/*`). The
  session rides on `@supabase/ssr` cookies; the browser never holds a Supabase key.
  Optimistic updates where safe.
- **Forms:** react-hook-form + Zod, with the **same Zod schemas** shared client↔API for
  validation (trivial in one codebase).
- **Ported logic:** the pure selectors (`selectors.ts`, `business-selectors.ts`,
  `cg-selectors.ts`, `growth-selectors.ts`, `academy-selectors.ts`) and the Jova engine
  move over as framework-free modules. They run **server-side in Route Handlers** against
  Supabase data; the client renders their results.
- **State:** replace `useSyncExternalStore` + `localStorage` store with server data +
  Query cache. No business data in the client bundle at build time.
- Production **loading, empty, and error states** for every async surface (the prototype's
  `LoadingSkeleton` / `EmptyState` become real).

## 3. Backend & API (Next.js Route Handlers)

Server logic lives in **Next.js Route Handlers** (`app/api/*`, Node runtime) colocated with
the app — no separate service and no Supabase Edge Functions. (Express is the drop-in
alternative if the API is later decoupled; the handler bodies and DB clients port as-is.)

- **Structure:** one route segment per domain (auth/session, workspace, contracts,
  compliance, risk, jova, reports, billing, files, admin), a shared middleware/util layer,
  and a service layer wrapping Supabase. Deploys with the app on Vercel.
- **Session/auth:** read the Supabase session from `@supabase/ssr` cookies on every request;
  Next.js middleware guards routes and refreshes sessions.
- **Data access via Drizzle** — two paths (see [ADR-0001](./ADR-0001-data-access.md)):
  1. **`withUser(claims, fn)`** — used for all user-scoped CRUD. Per request, in one
     transaction, it sets `request.jwt.claims` + `role = authenticated`, so **RLS runs in
     Postgres** on every query (the same effect PostgREST gives supabase-js).
  2. **`adminDb`** — server-only, RLS bypassed, for operations without a single current user:
     Stripe webhooks, Companies House fetches, report generation, bulk import/export, digest
     emails, seat enforcement, audit/notification writes. **Never used to serve a user
     request;** a guard test enforces this.
- **Schema:** hand-written SQL migrations are the source of truth; the Drizzle schema is
  generated by `drizzle-kit pull` (no Drizzle-managed migrations).
- **Validation:** all writes validated with Zod (schemas shared with the client); never
  trust client payloads.
- **Idempotency:** webhook handlers and plan changes keyed by provider event ID; safe to
  replay.
- **Errors:** typed, structured error envelope; no stack traces or secrets to the client.
- **Business logic:** the ported selectors, scoring, and the Jova engine execute here.
- **Pooler note:** behind the Supabase transaction pooler (6543), the Postgres driver sets
  `prepare: false`.
- **Runtime note:** handlers use the **Node runtime** (not Edge) so they can use the
  service-role key and Node SDKs (Stripe, Anthropic). Long tasks (large report/exports) run
  via the queue (below) and/or chunk to stay within serverless execution limits.

## 4. Data model & conventions

Full schema in [05-Backend-Schema.md](./05-Backend-Schema.md). Conventions (from handover §6):

- **Identifiers:** UUID/ULID immutable IDs. Never rely on names or array positions.
- **Dates:** ISO 8601 UTC in storage; render in workspace time zone. Date-only statutory
  deadlines stored as `date`.
- **Money:** ISO currency code + integer minor units (`GBP 9900` = £99.00).
- **Statuses:** controlled enums with explicit transition rules; no free-text statuses.
- **Relationships:** foreign-key IDs + `workspace_id` on every tenant-owned record.
- **Provenance:** `source`, `created_by`, `updated_by`, `created_at`, `updated_at`,
  `source_reference`, and confidence/verification where applicable.
- **Files:** object key, original filename, MIME type, size, checksum, owner, access
  classification, upload time, retention/review date.
- **Deletion:** soft-delete, legal hold, retention and irreversible deletion are distinct
  concepts, modelled separately.

## 5. Multi-tenancy & authorisation

- **Tenant unit:** `workspace` (an organisation may own one or more workspaces).
  Membership via `memberships (user_id, workspace_id, role)`.
- **Isolation:** RLS on every tenant table: `workspace_id in (select workspace_id from
  memberships where user_id = auth.uid())`. Role-sensitive actions gated by additional
  policy predicates and/or `SECURITY DEFINER` functions.
- **Adviser scoping:** time-limited grants (`expires_at`) + area scoping; enforced in policy,
  not UI.
- **Storage isolation:** bucket path prefixed by `workspace_id`; Storage RLS mirrors table
  RLS; downloads only via short-lived signed URLs.
- **Testing:** a dedicated tenant-isolation test suite proves no cross-workspace read/write
  via REST, RPC, Realtime, Storage, search, export, or Jova. This is a launch gate.

## 6. Authentication

- Supabase Auth: email/password + email verification, password reset, session management,
  account recovery.
- **MFA** available (recommended for Owner/Admin).
- **`@supabase/ssr` cookie-based sessions**: Next.js middleware refreshes and guards routes;
  Route Handlers read the session per request and build the user-scoped Supabase client.
- Invitations: signed invite tokens → join existing workspace with a specified role.

## 7. File & evidence storage

- **Private Supabase Storage buckets**, path `workspace_id/module/record_id/filename`.
- **Upload validation:** MIME allow-list (PDF, DOCX, XLSX, CSV, PNG/JPG/WebP), max size,
  checksum on store, and a **virus/malware scan hook** before the file is marked available.
- **Access:** short-lived signed URLs only; no public buckets. Sensitive/special-category
  documents classified and access-restricted independently of general module access.
- **Metadata row** per file (see `files`/evidence tables) with retention/review date.

## 8. Background jobs & scheduling

- **`pg_cron`** schedules jobs; each fires a **Supabase Edge Function** (via `pg_net`/HTTP):
  - Deadline/renewal/review reminders → notifications + email digests.
  - Scheduled report generation and exports.
  - Companies House cache refresh.
  - Async imports and full backups/exports.
  - Webhook retries / reconciliation.
- **Deno vs Node:** Edge Functions can't import the Node/Drizzle code. Jobs that reuse
  business logic have `pg_cron` call a **protected internal Route Handler** (one source of
  logic, using `adminDb`); simple DB-only jobs run in the Edge Function with the service role.
- Jobs bypass RLS via the **service role**, are idempotent, and observable (structured logs +
  failure alerts).
- *If a job outgrows the serverless model (very long-running or stateful), a small dedicated
  worker — or the Express alternative — can host it without changing the rest of the stack.*

## 9. Integrations

| Integration | Launch approach | Constraints |
|-------------|-----------------|-------------|
| **Companies House** | Read-only lookup of profile/officers/filing history, cached with `fetched_at` + refresh controls | Register app/API key; respect terms & rate limits; label source + retrieval time |
| **Official filing links** | Deep-link to GOV.UK / Companies House / HMRC; user records completion + evidence in Jojan One | **No filing claim;** clear hand-off + confirmation wording |
| **HMRC** | **Deferred.** If added later, only supported OAuth scopes + production approval | HMRC developer registration, user consent; **never** ask for Government Gateway passwords |
| **Payments (Stripe)** | Hosted Checkout + Customer Portal | Verified webhooks, PCI-scoped hosted collection, tax/invoice handling, **no raw card storage** |
| **Email** | Transactional (verification, invites, reminders) | Domain auth, consent/LI assessment, suppression, delivery logs |
| **AI provider (Phase 2)** | **Pluggable — Anthropic (Claude) or OpenRouter, one active at a time.** Controlled retrieval of authorised workspace data; deterministic fallback | DPA per provider, regional/privacy config, redaction, evaluation, **no training on customer data** unless explicitly agreed |

## 10. Jova technical requirements

- **Launch = deterministic engine** (port `jova-engine.ts`), running in a Route Handler.
  It reads only workspace records via RLS-bound queries and always returns the mandatory
  disclaimer + source references.
- **Logging:** every exchange persisted (`conversations`, `messages`, `jova_sources`) with
  rules/model version + safety decision + optional user feedback.
- **Phase 2 (controlled model) — pluggable provider:**
  - A **provider interface** with two adapters — **Anthropic (Claude)** and **OpenRouter** —
    selected by an `AI_PROVIDER` config flag; **exactly one is active** per environment. The
    retrieval, safety, source-attribution, and fallback layers are identical across adapters.
    - *Anthropic adapter:* `@anthropic-ai/sdk`, default model **`claude-opus-4-8`** (adaptive
      thinking); a lighter model (e.g. Claude Haiku 4.5) for cheap routing/classification.
    - *OpenRouter adapter:* OpenAI-compatible HTTP; model via `OPENROUTER_MODEL`.
  - Retrieval limited to the caller's authorised workspace data (RLS-filtered), plus an
    approved general-knowledge corpus.
  - **Source attribution** on every claim; refusal/escalation on regulated judgement.
  - **Evaluation suites** required before enablement (**run against each provider you intend
    to ship**): intent routing, factual grounding, access isolation (no cross-tenant
    leakage), refusal/escalation correctness, prompt-injection resistance.
  - **Deterministic fallback** (the launch engine) when confidence is low or retrieval is
    empty — provider-independent.
  - No customer data used for model training; regional processing; DPA per provider.

## 11. Non-functional requirements

| Area | Requirement |
|------|-------------|
| **Security** | Encryption in transit + at rest; managed secrets; least privilege; no secrets in client bundle; threat model + security review before go-live |
| **Privacy** | Data minimisation; sensitive-field classification; retention matrix; export/correction/deletion flows; DPIA before high-risk automated profiling/monitoring |
| **Availability** | Target SLA to confirm; managed Postgres with PITR; tested restore procedure |
| **Performance** | Fast first paint via SSR; indexed queries; pagination on large registers; signed-URL streaming for files |
| **Accessibility** | WCAG 2.1 AA target: keyboard nav, focus states, contrast, reduced-motion, responsive |
| **Observability** | Structured logs, metrics, traces, exception reporting (Sentry), audit alerts, runbooks — **no confidential data in logs** |
| **Compatibility** | Modern evergreen browsers; desktop + mobile responsive |
| **Recoverability** | Backups + tested restore; documented RPO/RTO |

## 12. Environments & delivery

- **Separate** local, test, staging, production — each its own Supabase project, Vercel
  deployment, Stripe mode + env config.
- **Migrations** version-controlled (`supabase/migrations`), applied via CI.
- **CI/CD:** lint, typecheck, unit/integration/e2e, tenant-isolation + a11y checks; preview
  deploys; production deploy with rollback.
- **Config/secrets** via environment + managed secret store; never committed.

## 13. Testing strategy

| Layer | Coverage |
|-------|----------|
| Unit | Selectors, scoring (confidence, risk, readiness), Jova routing/intents, Zod schemas |
| Integration | Route Handlers + middleware (session, RLS-as-user), Stripe webhooks (idempotency), Companies House caching, imports, AI provider adapters |
| E2E | Register→workspace→core journeys per module; billing upgrade/seat overage |
| **Tenant isolation** | Cross-workspace read/write attempts via REST/RPC/Realtime/Storage/search/export/Jova all denied |
| Accessibility | Automated axe checks on critical journeys + manual keyboard pass |
| Restore | Backup/restore rehearsal in a clean environment |

## 14. Migration from prototype

- The prototype's `CoreDataState` maps cleanly onto production tables (types already mirror
  the intended schema — see `src/data/types.ts`).
- Build a **migration/import utility**: seed reference/template data (Academy catalogue,
  obligation templates) as first-class content; treat per-business demo records as
  demonstration-only unless a specific dataset must carry over.
- Produce a **reconciliation report** + rollback plan for any real data brought across.

## 15. Key technical decisions to confirm

- Next.js migration vs. staying on TanStack Start (recommendation: migrate — see
  [00-Stack-Decision](./00-Stack-Decision.md)).
- **API tier:** Next.js Route Handlers (recommended) vs. a decoupled Express service.
- **Data access:** Drizzle with the `withUser()` RLS wrapper (decided — [ADR-0001](./ADR-0001-data-access.md)).
- **Background jobs:** Supabase Edge Functions + `pg_cron` vs. a dedicated worker (only if a
  job outgrows serverless).
- **AI provider** default (Anthropic vs. OpenRouter) and the model per adapter.
- Supabase region = **London (`eu-west-2`)** for UK residency.
- Report rendering approach (server-side HTML→PDF vs. print-CSS) for print-safe outputs.
- Search approach (Postgres full-text/`pg_trgm` vs. a dedicated search service) — must be
  RLS-safe.
- SLA, RPO/RTO targets, and the accessibility conformance target.
