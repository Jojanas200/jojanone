# Jojan One — Production Documentation

This folder contains the product and engineering documentation for taking **Jojan One**
from its current Lovable/TanStack prototype to a production, multi-tenant SaaS.

> **What Jojan One is:** a UK-focused business operating system for small businesses.
> It brings statutory obligations, contracts, people, governance, risk, investor & tender
> readiness, learning (Academy) and an always-on guidance assistant (**Jova**) into one
> calm, board-ready workspace.

## Document index

| #        | Document                                                                   | What it covers                                                        |
| -------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| —        | [Jojan_One_Production_Handover.docx](./Jojan_One_Production_Handover.docx) | The founder's original handover brief (source of truth for intent)    |
| 00       | [00-Stack-Decision.md](./00-Stack-Decision.md)                             | Recommended stack (Next.js + Supabase) and the trade-offs             |
| ADR-0001 | [ADR-0001-data-access.md](./ADR-0001-data-access.md)                       | Drizzle data layer + RLS wrapper; Edge Functions + pg_cron scheduling |
| 01       | [01-PRD.md](./01-PRD.md)                                                   | Product requirements — users, modules, scope, plans, success metrics  |
| 02       | [02-TRD.md](./02-TRD.md)                                                   | Technical requirements — architecture, security, integrations, NFRs   |
| 03       | [03-UI-UX-Design.md](./03-UI-UX-Design.md)                                 | Design system, layout, components, accessibility, brand rules         |
| 04       | [04-App-Flow.md](./04-App-Flow.md)                                         | End-to-end user journeys and navigation flows                         |
| 05       | [05-Backend-Schema.md](./05-Backend-Schema.md)                             | Postgres schema, RLS/tenant model, storage buckets                    |
| 06       | [06-Implementation-Plan.md](./06-Implementation-Plan.md)                   | Phased roadmap, milestones, exit criteria, estimates, **live progress** |
| 07       | [07-Security-Threat-Model.md](./07-Security-Threat-Model.md)               | Threat model, trust boundaries, controls, launch-blocking security items |
| 08       | [08-Privacy-and-DPIA.md](./08-Privacy-and-DPIA.md)                         | Privacy analysis + DPIA screening (UK GDPR)                           |
| 09       | [09-Runbooks-and-Go-Live.md](./09-Runbooks-and-Go-Live.md)                 | Operational runbooks and the go-live checklist                        |
| 10       | [10-Go-Live-Signoff-Register.md](./10-Go-Live-Signoff-Register.md)         | Go-live sign-off register                                             |

## Production build status

The production application is **built** — Next.js App Router + Supabase (Postgres + RLS +
Auth + Storage + pgvector, London) + the Drizzle `withUser()` data layer. It has been taken
through milestones **M0–M6** plus a **Lovable feature-parity programme (Waves 2–4)**: all
modules end-to-end with per-record detail/edit boards, a real Jova (Claude/OpenRouter with a
deterministic fallback) with semantic memory and persistent conversations, the GDPR /
investor / tender / simulator sub-registers, and policy drafting + version history. See the
live build log in **[06-Implementation-Plan → Progress (live)](./06-Implementation-Plan.md#progress-live)**;
tenant isolation is proven by the `verify-*` suite (2-tenant CRUD + RLS against hosted
Supabase). The sections below describe the original **prototype** — retained as the source of
product intent, not the current implementation.

## The prototype (source of intent)

- **Framework:** TanStack Start + React 19 + TypeScript + Vite 8 (built in Lovable).
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix primitives), Recharts, lucide-react.
- **Data:** entirely client-side — a seeded [`CoreDataState`](../src/data/types.ts) held in
  `localStorage` (see [`src/data/store.ts`](../src/data/store.ts)). No backend, auth, or
  file storage exists yet.
- **Jova:** a **deterministic** rules engine ([`src/data/jova-engine.ts`](../src/data/jova-engine.ts)),
  not an LLM. It routes intents, reads workspace records, and always appends a
  non-advice disclaimer.
- **18 modules** across 6 sections (see [`src/config/modules.config.ts`](../src/config/modules.config.ts)).

## Guiding principles (from the handover)

1. **Trustworthy foundation before features** — auth, tenancy, storage, audit first; no
   live government filing at launch.
2. **Server-enforced permissions** — hiding UI controls is _not_ access control. Tenant
   isolation is enforced at the database layer.
3. **Honest AI** — Jova stays deterministic at launch; a real model is introduced only
   behind controlled retrieval, source attribution, and human escalation.
4. **Never paywall safety** — safety notices, data export, and professional-support
   escalation are always available on every plan.
5. **Launch commercially around Starter (£39) and Growth (£99)**; keep Professional and
   Enterprise visible as roadmap.
