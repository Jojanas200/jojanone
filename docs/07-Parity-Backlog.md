# Lovable Parity Backlog

Consolidated result of the full route-by-route audit (2026-07-23) comparing the
Lovable prototype (`Jojan One - Platform/src/routes/*`) against production,
followed by the build-out that cleared it. Status last updated 2026-07-23 after
the final reconciliation batch.

**Programme status: COMPLETE**, except the two deferred items in the last
section. Every shipped item passed the standard gates (tsc, prettier,
adminDb/emdash guards) and, where it touches data, a 2-tenant RLS verifier
against the hosted Supabase project.

## Tier 1 - Subsystems (all shipped)

### Contracts - DONE
Full ~18-field create form; deterministic issues/alerts engine (expired-but-
active, notice deadlines, overdue actions) on rows, cards and drawer;
cards/table view toggle; complete-next-action; currency + business-entity
linking on create/edit; print summary. Verifier: verify-contracts (18).

### Tender Ready - DONE
Opportunity detail drawer with full 16-field edit + duplicate; requirements and
responses linked to opportunities; per-opportunity submission checklist with a
mandatory-items "ready to submit" gate (migration 0024, jsonb on the
opportunity); response versioning + copy-to-clipboard; opportunity + response
print. Evidence linking deliberately reuses the existing shared evidence
library rather than a parallel tender store. Verifier:
verify-tender-readiness (25).

### Simulator - DONE
Questionnaire -> advisory engine (src/shared/scenarios/engine.ts): typed and
conditional questions per scenario, deterministic result with impact level,
summary, affected-module chips, risks, prioritised actions, documents,
deadlines and professional-support callouts (IR35/DBS/DPIA/transfer rules).
Category gallery + stepped wizard + review step; saved runs reopen their stored
result. The production-only confidence-projection tool is retained. Verifier:
verify-scenarios (11).

### Academy - DONE
Course player at /academy/[courseId]: 7-section lessons (objective, learn,
example, apply-scenario with graded feedback, action links, knowledge checks,
recap), lesson progress with course-completion stamping, 80%-pass final quiz
issuing printable certificates (threshold re-enforced server-side); catalogue
search + filters; assign-training-to-team dialog with learner column and
legally-required flag; deterministic recommendations engine
(academy-insights.ts) reading ten modules; overview tiles (overdue, overall
progress %); training-report link. Learning-hours tile deliberately omitted
(no time tracking - would be fabricated). Verifier: verify-academy (16).

## Tier 2 - Cross-cutting layers (all shipped)

### Print/PDF - DONE
Shared, HTML-escaping print utility (app/(app)/_shared/print.ts) wired into:
risk one-pager (incl. mitigations), contract summary (incl. issues),
compliance obligation (incl. recorded evidence), GDPR breach record, privacy
notice (draft banner), investor funding profile, data-room index, tender
opportunity (incl. linked requirements), tender response, academy certificate
+ course resource, executive briefing preview.

### Detail drawers + inline actions - DONE
Activity mark-complete (service + route) from the timeline drawer; timeline
?a=<id> deep links + reference display; executive decisions with metadata and
inline Approve/Defer; dashboard priority "Ask Jova" seeded per priority.

### Jova - DONE (capability parity)
Stored citations rehydrate when reopening conversations; source badges are
deep links into the cited modules; 16 curated prompts; /jova?q= composer
seeding from any record. Lovable's mock answer widgets were NOT ported as-is -
production answers come from a grounded LLM with deterministic fallback;
rich structured answer cards would come from model structured output (future).
Verifier: verify-jova-conversations (15).

## Tier 3 - Page residuals (all shipped)

- GDPR: overview tab, 8-metric row incl. ICO-fee indicator, policies
  cross-link, notice builder with side-by-side live preview + print.
- Risk: mitigation/treatment plans (migration 0023), overdue-review and
  overdue-mitigation tiles. Verifier: verify-risk (15).
- Investor: DD board with search/filters, rich fields, edit drawer,
  mark-N/A-with-reason. Verifier: verify-investor-readiness (21).
- Compliance: standalone add-evidence without completing (multiple evidence
  per obligation). Verifier: verify-evidence (13).
- Reports: source-modules rendered on detail; section-selection checkboxes on
  generate (server honours the selection).
- Business Map: linked contracts on entities (via contracts.entity_id), soft
  archive/restore, per-relationship Ask Jova.
- HR: cards/table toggle, record-review (+90d) quick action, action
  defer/reopen lifecycle.
- Dashboard: Upcoming (30d) tile from live timeline sources, Reports tile.
- Executive: computed growth tiles (investor /100, tender /100, DD-ready %),
  in-page report preview/print.
- Settings: profile identity/contact fields + VAT number + four operation
  toggles (migration 0025); permissions matrix reference table.
  Verifier: verify-settings (11).
- Governance, Policies, earlier GDPR/HR/Risk/Compliance forms: shipped in the
  pre-audit reconciliation passes (see docs/06 progress log).

## Remaining (deferred - need backend plumbing first)

1. Notification + Jova preference panels. UI-only stubs would violate the
   honest-data rule: preferences must actually drive the digest cron and the
   ask pipeline. Requires a preferences store read by both, then the UI.
2. Resend invitation + tenant-visible audit log. Resend needs the invite
   token/email flow re-triggered safely; the audit log needs a tenant-scoped
   event surface (platform_audit_log is operator-only).

## Explicitly skipped (not parity gaps)
- HR leave/absence, payroll, org chart, document attachments: absent in the
  prototype too (net-new features, not mirrors).
- Lovable mock behaviours production intentionally replaces (fabricated
  deltas, hard-coded scores, browser-only logo, in-memory stores).
- Governance embedded Policies tab (production has a richer /policies).
