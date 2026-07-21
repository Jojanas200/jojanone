# 00 — Stack Decision

## TL;DR recommendation

**Yes — Next.js (App Router) + Supabase is a strong, well-trodden fit for Jojan One**, with
**Next.js Route Handlers** as the server tier and a **pluggable AI provider** (Claude *or*
OpenRouter, one active at a time). Supabase in particular maps almost 1:1 onto the handover's
hard requirements. I'd adopt it with these deliberate choices:

1. **Supabase Postgres + Row-Level Security (RLS)** as the tenant-isolation backbone.
2. **Supabase Storage** (private buckets + short-lived signed URLs) for evidence/documents.
3. **Next.js Route Handlers** (`app/api/*`, Node runtime) for all server logic —
   integrations, webhooks, report generation, imports, Jova — colocated with the app in one
   codebase and one Vercel deploy. (A standalone **Express.js** service is the drop-in
   alternative if you later want the API decoupled from the UI — see the comparison below.)
4. **Drizzle ORM** as the DB client, with a `withUser()` wrapper that runs each request's
   queries as the caller so **RLS still enforces in Postgres** (plus an `adminDb` escape
   hatch for trusted jobs). SQL migrations stay the source of truth — see
   [ADR-0001](./ADR-0001-data-access.md).
5. **Scheduled work on Supabase Edge Functions + `pg_cron`** (reminders, digests, CH refresh).
6. **A provider-agnostic AI layer** with two adapters — **Anthropic (Claude)** and
   **OpenRouter** — selected by config so exactly one is live at a time.
7. **Next.js on Vercel**, with the **UK/EU Supabase region (London, `eu-west-2`)** for data
   residency.

The one thing to go in with eyes open: the prototype is **TanStack Start**, not Next.js.
Moving to Next.js is a reasonable, mostly mechanical migration (the UI layer is
framework-agnostic shadcn/Radix), but it is not free. See the trade-off below.

## Why Supabase is the right call

The handover has several **non-negotiables**. Supabase satisfies them natively:

| Handover requirement | Supabase mechanism |
|----------------------|--------------------|
| "Permissions enforced on the server **and database layer**. Hiding controls in the UI is not access control." | **RLS policies** on every tenant-owned table — enforcement lives in Postgres, not the client. |
| "No user can read or change another workspace's data, including through URLs, exports, search, files or Jova." | RLS keyed on `workspace_id` + `auth.uid()`; Storage RLS for files; the same policies cover REST, RPC, and Realtime. |
| "Secure document/evidence storage with upload validation, access control and retention metadata." | Private **Storage buckets** + signed URLs + row metadata + object-level policies. |
| "Production authentication, password reset, sessions and account recovery." | **Supabase Auth** (email/password, magic link, OAuth, MFA, recovery). |
| "Managed relational database with migrations, constraints, indexes, tenant policies and point-in-time recovery." | Managed Postgres, `supabase/migrations`, PITR on Pro plans. |
| "All important mutations create attributable audit events." | Postgres triggers / `audit_events` table written server-side. |
| "Encrypt in transit and at rest; managed secrets; never place secrets in the browser bundle." | TLS + at-rest encryption; secrets in server env / Vault; service-role key never shipped to client. |
| "Background work: queue/scheduler for reminders, reports, imports, webhooks." | **Supabase Edge Functions + `pg_cron`** (logic-heavy jobs call a protected Route Handler; DB-only jobs run in the Edge Function with the service role). |

RLS is the decisive factor. It turns the "tenant isolation must be tested and provable"
requirement into declarative policy you can unit-test, rather than app code you hope is
correct on every path.

## Next.js vs. staying on TanStack Start

| Factor | Next.js (App Router) | Keep TanStack Start |
|--------|----------------------|----------------------|
| Migration cost | Medium — re-do routing, layouts, data loading; **keep** all shadcn/Radix components, Tailwind theme, and pure logic (`selectors`, `jova-engine`) verbatim | **Zero** — build straight on the prototype |
| Supabase ecosystem | Best-in-class: `@supabase/ssr` cookie helpers, middleware auth, documented patterns | Works (Supabase is framework-agnostic) but fewer turnkey recipes |
| Hiring / docs / longevity | Largest React talent pool and reference material | Smaller, newer ecosystem |
| Server routes for webhooks/integrations | **Route Handlers** (Node runtime) — first-class | Nitro server routes (works, smaller ecosystem) |
| Hosting | Vercel (or self-host/Node) | Vercel/Netlify/Node |

**My recommendation:** go **Next.js** if you value the larger hiring pool, the mature
Supabase-auth SSR story, and long-term ecosystem gravity — which matters when you're
about to hire a technical partner. The pure business logic (the `*-selectors.ts` files and
`jova-engine.ts`) is plain TypeScript with no framework coupling and ports directly; the
shadcn/ui components are identical across both frameworks. Budget the migration as part of
**Milestone 1 (Production Foundation)** rather than a separate project.

If speed-to-first-integration is the only priority and you're comfortable with a smaller
ecosystem, staying on TanStack Start is *defensible* and saves the migration — but you'll
be swimming against the current on Supabase-auth patterns and future hiring.

## Recommended production stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | **Next.js 15 (App Router) + React 19 + TypeScript** | Reuse shadcn/ui, Tailwind 4, Recharts, lucide-react from the prototype |
| Styling | **Tailwind CSS 4 + shadcn/ui** | Preserve the existing brand tokens and Jova visual direction |
| Auth | **Supabase Auth** | Email/password + MFA; `@supabase/ssr` for cookie sessions |
| Database | **Supabase Postgres (London region)** | RLS-first; migrations in-repo |
| Data access | **Drizzle ORM** (query builder + types) | `withUser()` runs queries as the caller (RLS enforced); `adminDb` for trusted jobs; schema via `drizzle-kit pull` |
| File storage | **Supabase Storage** (private buckets) | Signed URLs, MIME/size validation, virus scan hook, retention metadata |
| **Server / API** | **Next.js Route Handlers** (`app/api/*`, Node runtime) | Single tier colocated with the UI: CRUD, integrations, webhooks, report generation, imports, Jova. *(Express is the decoupled alternative.)* |
| Background jobs | **Supabase Edge Functions + `pg_cron`** | Reminders, scheduled reports, digest emails, CH refresh (logic-heavy jobs call a protected Route Handler) |
| Payments | **Stripe Checkout + Customer Portal** | Verified webhooks (Route Handler) drive canonical subscription state |
| Company data | **Companies House Public Data API** (read-only) | Cached with `fetched_at`; deep-links to GOV.UK for filing |
| Email | **Resend / Postmark** (transactional) | Verification, invites, reminders; domain auth + suppression |
| AI (phase 2) | **Pluggable provider — Anthropic (Claude) *or* OpenRouter** | One active at a time via config, behind a retrieval + safety layer; deterministic fallback preserved; no training on customer data |
| Observability | **Sentry + structured logs + Supabase logs** | No confidential data in logs |
| Hosting | **Vercel** (Next.js app + API) + **Supabase** (data plane) | Separate local / staging / production projects |

## Route Handlers vs. Express (and why Route Handlers win here)

Both give you real server-side HTTP endpoints on the Node runtime with full access to
secrets, the service-role key, and Node SDKs (Stripe, Anthropic, …). They are
interchangeable in capability; the difference is packaging and ops.

| | **Next.js Route Handlers** (chosen) | **Express** (alternative) |
|---|---|---|
| Packaging | Inside the Next.js app (`app/api/*`) — one codebase | Separate Node service |
| Deploy | One Vercel deploy for UI + API | Two deploys (Vercel UI + Render/Railway/Fly.io API) |
| Supabase auth | Best-supported (`@supabase/ssr` cookie sessions) | Works (verify JWT in middleware) |
| Background/long jobs | **No persistent worker** → Supabase Edge Functions + `pg_cron`; watch serverless timeouts | Natural home for a long-running worker |
| Shared types | Zod schemas shared UI↔API with zero packaging | Shared via a package/monorepo |
| When to pick | Default — simpler, one framework, fastest to ship & hire for | You need the API decoupled, a persistent worker, or non-Vercel hosting |

**Route Handlers are the default.** Reach for Express only if you later need the API
independent of the UI (separate scaling/hosting) or a persistent worker process the
serverless model can't host. Migrating Route Handlers → Express is mechanical (the handler
bodies and the Supabase/service-role clients move as-is).

### How Route Handlers keep RLS as the isolation guarantee

Using a custom API tier and keeping RLS in charge are **not** in tension — the key is how the
handler authenticates to Postgres:

- The **browser calls the Route Handler** carrying its Supabase session (`@supabase/ssr`
  cookies, or a bearer JWT). No Supabase key is ever in the browser bundle.
- The handler runs its queries through **Drizzle's `withUser()`** wrapper, which (per request,
  in one transaction) sets `request.jwt.claims` + `role = authenticated`. Queries run **as the
  user**, so **RLS still executes in Postgres** — the database remains the single source of
  truth for tenant isolation, exactly as the handover demands. (`supabase-js` gets this for
  free via PostgREST; with Drizzle we replicate it explicitly — see
  [ADR-0001](./ADR-0001-data-access.md).)
- **`adminDb`** (service-role, RLS bypassed) stays server-side and is used only for trusted
  operations: Stripe webhooks, Companies House fetches, cron jobs, cross-tenant admin, and
  audit/notification writes.

```
Browser ──session──► Route Handler ──┬── Drizzle withUser(claims)  (role=authenticated) → RLS enforced
 (Next.js)                           │
                                     └── Drizzle adminDb (service role, server only)     → webhooks, jobs, admin
```

Even a bug in a handler cannot read across tenants, because the RLS policy is evaluated in
the database on every query. A dedicated tenant-isolation test suite (see the schema doc)
verifies this across every access path. If a specific screen needs Realtime, it can still
open an RLS-guarded Supabase subscription directly.

## AI provider abstraction (Claude *or* OpenRouter)

Phase-2 Jova is built against a small **provider interface**, with a config flag selecting a
single active adapter at runtime:

```ts
// One interface, two adapters — exactly one is active per environment.
interface LlmProvider {
  complete(req: LlmRequest): Promise<LlmResponse>;   // + a streaming variant
}

// AI_PROVIDER = "anthropic" | "openrouter"
const provider: LlmProvider =
  config.AI_PROVIDER === "openrouter"
    ? new OpenRouterProvider(config.OPENROUTER_API_KEY, config.OPENROUTER_MODEL)
    : new AnthropicProvider(config.ANTHROPIC_API_KEY);  // default
```

- **Anthropic adapter** — uses the official `@anthropic-ai/sdk`; default model
  **`claude-opus-4-8`** (adaptive thinking), a lighter model (e.g. Claude Haiku 4.5) for
  cheap routing/classification. First-party features (prompt caching, structured outputs)
  available.
- **OpenRouter adapter** — OpenAI-compatible HTTP endpoint; model chosen via
  `OPENROUTER_MODEL`. Useful for provider flexibility, cost routing, or A/B.
- **One at a time:** the two adapters are never both live in a request path. Switch by
  changing `AI_PROVIDER` per environment; the retrieval, source-attribution, safety, and
  **deterministic-fallback** layers wrap the provider and are identical regardless of which
  adapter is selected.
- **Data terms:** confirm each provider's regional processing and no-training-on-customer-data
  terms before enabling it (see [TRD §9](./02-TRD.md)). The deterministic engine remains the
  fallback whenever retrieval is empty or confidence is low.

## Alternatives considered (and why not, for now)

- **Postgres + hand-rolled Node/Nest API:** more control, but you rebuild auth, RLS,
  storage, and realtime that Supabase gives you for free. Only worth it at much larger scale.
- **Firebase/Firestore:** document model fights the highly relational, cross-linked data
  (risks link to obligations, contracts, employees…). Postgres foreign keys fit far better.
- **Prisma + PlanetScale/Neon + Clerk/Auth.js:** perfectly viable and swappable later, but
  you lose the single-vendor cohesion (DB + Auth + Storage + RLS + Realtime) that makes the
  tenant-isolation guarantee cheap to prove. Keep this as the "eject" path if Supabase ever
  becomes a constraint.

## Data-residency note

The handover expects UK data handling. Provision the Supabase project in **London
(`eu-west-2`)**, keep Stripe on a UK entity, host email sending on a UK/EU region where
possible, and confirm any AI provider's regional/no-training terms before Phase 2.
