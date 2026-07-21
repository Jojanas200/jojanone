# 01 — Product Requirements Document (PRD)

**Product:** Jojan One
**Version:** 1.0 (production scope)
**Status:** Draft for build
**Source of intent:** [Jojan One Production Handover & Implementation Brief](./Jojan_One_Production_Handover.docx)

---

## 1. Vision & problem

UK small businesses juggle statutory obligations, contracts, people, governance, risk,
funding readiness and tender readiness across spreadsheets, inboxes and their own memory.
Nothing joins it up, and professional advice is expensive and reactive.

**Jojan One is a UK business operating system** that brings all of this into one calm,
board-ready workspace, with an always-on assistant (**Jova**) that explains what matters,
why, and what to do next — in plain English, and without pretending to be a lawyer or
accountant.

### Product promise

> Know where your business stands, what's coming up, and what to do about it — with
> evidence you can show a lender, insurer, investor or buyer.

## 2. Goals & non-goals

### Goals (launch)

- A trustworthy, multi-tenant SaaS with real auth, hosted data, secure file storage, and
  audit trails.
- Guided workflows across all 18 existing modules with manual data entry, evidence records,
  reminders, reports, Academy and Jova guidance.
- Companies House read-only enrichment and honest deep-links to official filing services.
- Self-serve Starter/Growth subscriptions via Stripe.
- Jova preserved as a safe, deterministic guide.

### Non-goals (explicitly deferred)

- Direct HMRC submissions or storing Government Gateway credentials.
- Direct Companies House filing.
- Claims of "live" legal/regulatory monitoring or automated compliance.
- External tender-portal submission, document e-signature, complex enterprise integrations.
- Enforcing Professional/Enterprise entitlements before those features exist.
- Treating Academy completion as accreditation or proof of compliance.

## 3. Target users & personas

| Persona                               | Description                                | Primary needs                                                                  |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| **Founder / owner-manager**           | Runs a 1–20 person UK Ltd; wears every hat | See overall position at a glance; know deadlines; be "ready" for money/tenders |
| **Operations / office manager**       | Keeps the business running day-to-day      | Track contracts, HR actions, obligations, evidence                             |
| **Adviser / accountant / consultant** | External, scoped, time-limited access      | Review specific areas, comment, no cross-module snooping                       |
| **Team member**                       | Employee completing assigned work/training | Update assigned records, complete Academy, upload evidence                     |

## 4. Roles & access (product level)

Enforced server-side (see [TRD](./02-TRD.md) and [Schema](./05-Backend-Schema.md)).

| Role            | Access                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Owner/Admin** | Full workspace administration: billing, users, exports, settings, all modules                     |
| **Manager**     | Manage operational modules and reports; no destructive workspace/billing actions unless delegated |
| **Team Member** | View/update assigned records, complete training, contribute evidence                              |
| **Adviser**     | Time-limited, scoped view/comment on approved areas only; no hidden cross-module access           |
| **Read Only**   | View permitted records/reports; no mutation or export unless granted                              |

**Non-negotiable:** permissions are enforced at the server/database layer. Hiding controls
in the UI is not access control.

## 5. Modules (functional scope)

Six sections, 18 modules. Status reflects the prototype's own labels; production migrates
all of them.

### 5.1 Core Intelligence

| Module        | Purpose                      | Key capabilities                                                                 |
| ------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| **Dashboard** | Business at a glance         | Business Confidence Score, daily Jova briefing, priority actions, quick nav      |
| **Executive** | Leadership-level health view | Cross-module risk summary, board-ready snapshots, trends, briefings              |
| **Timeline**  | Chronological record         | Full activity history, filterable, audit-ready, milestones                       |
| **Reports**   | Turn data into evidence      | Compliance/exec/risk reports, builder, scheduled exports, shareable summaries    |
| **Jova**      | Always-on guidance           | Risk detection, plain-language explanations, guided resolution, human escalation |

### 5.2 Business

| Module           | Purpose                           | Key capabilities                                                                      |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| **Simulator**    | Test decisions before making them | Scenario modelling (hire, contractor, new market, raise, tender, AI…), impact preview |
| **Business Map** | See business structure            | Entity/relationship/ownership mapping, review tracking                                |
| **Contracts**    | Contracts understood at a glance  | Register, risk flagging, key terms, renewal/notice tracking                           |
| **HR**           | People risk made visible          | Employees, right-to-work, probation, policy ack, training, HR actions                 |

### 5.3 Compliance & Governance

| Module         | Purpose                           | Key capabilities                                                                       |
| -------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| **Compliance** | Every obligation tracked          | Obligations register, deadlines, evidence, plain-language + source-cited explanations  |
| **GDPR**       | Data protection handled           | Health check, ROPA, DSARs, breaches, DPIAs, privacy notices                            |
| **Governance** | Board discipline without overhead | Decisions, resolutions, minutes, governance calendar                                   |
| **Policies**   | The policies the business runs on | Versioned register, owners, review dates, scheduled reminders, staff sign-off tracking |
| **Risk**       | Complete picture of risk          | Risk register, inherent/residual scoring, controls, mitigations, links                 |

### 5.4 Growth

| Module             | Purpose                  | Key capabilities                                                                |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------- |
| **Investor Ready** | Be ready before they ask | Readiness assessment, due-diligence checklist, data room, scoring               |
| **Tender Ready**   | Win more bids            | Opportunities, Bid/No-Bid assessment, requirements, responses, evidence library |

### 5.5 Learning

| Module      | Purpose                             | Key capabilities                                               |
| ----------- | ----------------------------------- | -------------------------------------------------------------- |
| **Academy** | Build capability, evidence learning | Courses, lessons, quizzes, assignments, progress, certificates |

### 5.6 System

| Module       | Purpose                      | Key capabilities                                                                                           |
| ------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Settings** | Your business, data, control | Profile, users/access, notifications, display, branding, document defaults, backup, audit, Plans & Billing |

## 6. Cross-cutting product concepts

- **Business Confidence Score** — a weighted roll-up across modules (see
  [`ConfidenceFactor`](../src/data/types.ts)) with status labels _Good / Needs Attention /
  At Risk_, a change delta, and a plain-language explanation. Must be explainable
  (score breakdown drawer), never a black box.
- **Activities** — a unified stream of obligations, filings, reviews, contracts, risks,
  decisions, reports, training and meetings feeding Dashboard, Timeline and notifications.
- **Evidence** — records and uploaded files that substantiate obligations, readiness items,
  tender requirements and reports.
- **Reports & certificates** — print-safe outputs that must retain mandatory
  non-advice / non-accreditation wording.
- **Notifications** — priority / report / insight / risk items surfaced in-app (and, in
  production, by email/digest).

## 7. Jova requirements (product)

Jova is the trust centre of the product. Requirements (must all hold at launch):

1. **Mandatory disclaimer on every substantive reply:**
   _"Jova provides business information and guidance, not legal advice. Where professional
   judgement is required, Jova will recommend expert support."_
2. **Clarify ambiguity** — e.g. "Are we ready?" prompts a "Ready for what?" choice
   (investor / tender / compliance / GDPR / overall).
3. **Answer only from authorised workspace data** and approved general content; **cite the
   source module/record**.
4. **State limitations and uncertainty**; never invent filings, deadlines, external status
   or professional conclusions.
5. **Escalate** legal, tax, HR, data-protection, health-and-safety, cyber and regulated
   matters to an appropriate professional when judgement is required.
6. **Never expose hidden quiz answers** before submission; never treat Academy completion
   as accreditation or compliance proof.
7. **Log** prompts, responses, source references, rules/model version, safety decision and
   user feedback, with retention controls.
8. At launch Jova is **deterministic**. Any future model runs behind controlled retrieval,
   source attribution, access filtering, evaluation suites (routing, grounding, access
   isolation, refusal/escalation, prompt-injection resistance) and a deterministic fallback.

## 8. Subscription strategy

| Plan             | Price   | Seats    | Launch treatment                                                                                                                 |
| ---------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Starter**      | £39/mo  | 1        | **Sell now.** Low-friction entry: dashboard, executive, timeline, reports, Jova guidance, core compliance, basic Academy, export |
| **Growth**       | £99/mo  | up to 5  | **Sell now & feature as recommended.** Operational, governance, risk, growth, full Academy, branded outputs                      |
| **Professional** | £249/mo | up to 20 | Visible as "Coming later / Join waitlist" until advanced permissions, reporting & support exist                                  |
| **Enterprise**   | Custom  | —        | Visible as "Talk to us"; scoped only via contract + discovery                                                                    |

### Billing & entitlement rules

- **One canonical subscription record** drives the plan summary, plan cards, usage warnings
  and permissions.
- Production must handle seat overage explicitly: block additional active seats, offer
  upgrade, or apply an explicit grace policy (the prototype deliberately shows 3 users on
  Starter's 1-seat allowance to illustrate overage).
- **Never paywall** safety notices, data export, or professional-support escalation.
- Plan changes are **idempotent** and driven by **verified Stripe webhooks**, not browser
  state.
- Do **not** charge for Professional/Enterprise until their entitlements can be fulfilled.

## 9. Success metrics

| Category    | Metric (launch targets to confirm with founder)                                              |
| ----------- | -------------------------------------------------------------------------------------------- |
| Activation  | % of new workspaces that complete business profile + first obligation/contract within 7 days |
| Engagement  | Weekly active workspaces; Jova conversations per active workspace                            |
| Value proof | # reports generated; # evidence items stored; readiness score improvement over time          |
| Commercial  | Trial→paid conversion; Starter→Growth upgrade rate; MRR; churn                               |
| Trust       | Jova escalation-correctness rate; zero cross-tenant incidents; audit coverage of mutations   |

## 10. Acceptance criteria (product-level, from the handover)

1. A user can register/sign in, create or join the correct workspace, and recover access
   securely.
2. No user can read or change another workspace's data — via URLs, exports, search, files
   or Jova.
3. Core records persist across browsers/devices; backups can be restored in a tested
   environment.
4. Starter/Growth subscription state and seat allowances are consistent on every screen and
   driven by backend/provider state.
5. Companies House data is labelled with source and retrieval time; failures/stale data are
   handled honestly.
6. Jova asks for clarification when needed, cites authorised source records, preserves
   mandatory safeguards, and escalates sensitive matters.
7. All important mutations create attributable audit events.
8. Critical journeys work on desktop and mobile and meet the agreed accessibility target.
9. No raw card data, Government Gateway credentials, API secrets or cross-tenant information
   is stored in the client.

## 11. Open product questions

- Exact feature-to-plan entitlement matrix (which modules/limits per tier)?
- Trial length and trial→paid mechanics (card upfront vs. not)?
- Annual billing / discount treatment?
- Which seeded prototype records are demo-only vs. must be migrated as real content
  (e.g. Academy course catalogue, obligation templates)?
- Launch accessibility target (WCAG 2.1 AA assumed) and supported browsers/devices?
- Which personal-data categories and file types are truly required at launch (data
  minimisation)?
