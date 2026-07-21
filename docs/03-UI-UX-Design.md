# 03 — UI/UX Design

**Product:** Jojan One · **Companion docs:** [PRD](./01-PRD.md), [App Flow](./04-App-Flow.md)

The prototype already establishes the intended visual language. This document codifies it
so production preserves the "premium, calm, board-ready" direction without redesigning
working flows.

---

## 1. Design principles

1. **Calm and board-ready** — generous whitespace, restrained colour, quiet typography. The
   product should feel like something you'd open in front of your board or bank.
2. **Clarity over cleverness** — plain English, explainable scores, obvious next actions.
3. **Semantic status stays semantic** — success/warning/danger/info/disabled must remain
   legible and are **independent of the brand colour** (a user can recolour the brand; they
   can't recolour "danger" into ambiguity).
4. **Evidence you can show** — reports and certificates are print-safe and carry mandatory
   non-advice / non-accreditation wording.
5. **Accessible by default** — WCAG 2.1 AA: keyboard-navigable, visible focus, sufficient
   contrast, reduced-motion support, responsive.

## 2. Brand & theming

- **Logo & name:** preserve the uploaded Jojan One logo ([`docs/logo.jpg`](./logo.jpg)) and
  the "Jojan One" wordmark in the header (see [`BrandLogo`](../src/components/core/BrandLogo.tsx)).
- **User-selectable safe primary colour** — the workspace can pick a brand colour
  ([`BrandTheme`](../src/components/core/BrandTheme.tsx)); the system constrains it to an
  accessible range so contrast never breaks.
- **Colour system** (from [`src/styles.css`](../src/styles.css)) — all colours in **oklch**,
  driven by CSS custom properties, with light and `.dark` themes:
  - Page background: warm neutral (`~#F7F8FA`); cards: white.
  - Foreground: navy (`~#1B2A4A`); accent: corporate blue.
  - Semantic tokens: `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`,
    plus `--chart-1..5` and a dedicated `--sidebar-*` set.
- **Radius scale:** base `--radius: 0.625rem` with `sm→4xl` derived steps — soft, modern.
- **Type:** Inter (variable) via `@fontsource-variable/inter`; tight tracking on headings.
- **Rule:** production must keep semantic status colours distinct from the brand colour, and
  keep the theme token layer intact (don't hardcode hex values in components).

## 3. Layout & navigation

Established in [`AppShell`](../src/components/AppShell.tsx):

- **Left sidebar** grouped by the six sections (Core Intelligence, Business, Compliance &
  Governance, Growth, Learning, System) — collapsible, with section labels and active-route
  highlighting. Order and grouping come from
  [`modules.config.ts`](../src/config/modules.config.ts).
- **Top bar:** brand/wordmark, **global search** (`GlobalSearch`), **notifications**
  (`NotificationsPopover`), user avatar/menu.
- **Content area:** module pages render inside the shell; a persistent **Jova** entry point
  is always reachable.
- **Responsive:** sidebar collapses to a drawer (`Menu`/`X`) on mobile; content reflows to a
  single column. Critical journeys must work on mobile.

```
┌──────────────────────────────────────────────────────────────┐
│  [≡] Jojan One            🔍 Search        🔔   (Avatar ▾)     │  top bar
├───────────────┬──────────────────────────────────────────────┤
│ CORE INTEL    │                                              │
│  Dashboard  ● │   ┌── Page header: title · actions ───────┐  │
│  Executive    │   │  Business Confidence  ▸ score + trend  │  │
│  Timeline     │   └────────────────────────────────────────┘  │
│  Reports      │   ┌── MetricCards row ─────────────────────┐  │
│  Jova         │   │  [ ] [ ] [ ] [ ]                        │  │
│ BUSINESS      │   ├── Priority actions / module content ───┤  │
│  Simulator    │   │  cards · tables · drawers               │  │
│  …            │   └────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────┘
```

## 4. Component library

Built on **shadcn/ui + Radix** (already in `src/components/ui`). Reusable **core** patterns
(`src/components/core`) that production should keep and harden:

| Component | Role |
|-----------|------|
| `MetricCard` | KPI tile (value, hint, trend) |
| `PriorityActionCard` / `ActivityCard` | Today's actions and activity items |
| `StatusPill` / `StatusBadge` | Semantic status display |
| `ScoreBreakdownDrawer` | Explains the Business Confidence Score (transparency) |
| `DetailDrawer` / `ActivityDetail` | Right-side record detail without leaving context |
| `FilterBar` | Consistent filtering across registers |
| `GlobalSearch` | Cmd-palette-style cross-module search (must be RLS-safe in prod) |
| `NotificationsPopover` | Priority/report/insight/risk notifications |
| `ReportCard` / `ReportPreviewModal` | Report browsing + print-safe preview |
| `MessageBubble` / `ConversationListItem` / `JovaMark` | Jova chat surface |
| `EmptyState` / `LoadingSkeleton` | First-run and async states (make real in prod) |
| `ConfirmDialog` | Guard destructive actions |
| `ModuleLandingPage` / `ModuleLinkCard` | Consistent module intros + cross-links |

**Data-display conventions:** registers use tables with `FilterBar` + pagination; a record
opens in a `DetailDrawer`; edits use dialogs with react-hook-form + Zod; destructive actions
require `ConfirmDialog`.

## 5. Jova UX

- Entry from the top bar / sidebar and contextually (a record's "Ask Jova" affordance passes
  a `reference_type` + `reference_id`).
- **Chat surface:** conversation list + message bubbles; Jova replies can include:
  - a **suggested action** (navigate / generate report / open activity or report),
  - **structured content** (linked items, a headline metric, score factors, or clarifying
    **choices**),
  - and the **mandatory disclaimer**.
- **Ambiguity handling:** "Are we ready?" renders choice chips ("Investor / Tender /
  Compliance / GDPR / Overall") rather than guessing.
- **Escalation:** sensitive/regulated topics surface a clear "seek professional support"
  message — visually distinct, never hidden, never paywalled.
- **Sources:** replies cite the module/record they draw from and link straight to it.

## 6. Reports, certificates & print

- Reports render from structured `sections` + `metrics` + `findings` + `priority_actions`.
- **Print-safe** layouts (dedicated print CSS / server-rendered PDF) with the workspace
  branding and **mandatory non-advice wording**; Academy certificates carry
  **non-accreditation** wording.
- Exports available on every plan (never paywalled).

## 7. Accessibility checklist

- Full keyboard operability; logical tab order; visible focus rings (`--ring`).
- Contrast meets AA for text and essential UI against both light and dark themes.
- Status is never conveyed by colour alone (pair with icon/label).
- `prefers-reduced-motion` respected for transitions/animations.
- Dialogs/drawers trap focus and restore it on close (Radix defaults — keep them).
- Forms: associated labels, inline validation messages, error summaries.
- Responsive down to small mobile; no horizontal page scroll; wide tables scroll in-container.

## 8. States & feedback

- **Empty:** every register/module has a purposeful first-run `EmptyState` with a primary
  action.
- **Loading:** skeletons for initial loads; inline spinners for mutations; optimistic UI
  where safe.
- **Error:** honest, recoverable error states; Companies House/stale-data clearly labelled
  with source + retrieval time.
- **Success:** toast confirmations (`sonner`) for mutations; audit-relevant actions confirm
  what was recorded.

## 9. What must NOT change

Per the handover's brand requirements:

- Don't redesign the established Dashboard / Executive / Jova visual direction or working
  flows.
- Don't couple semantic status colours to the brand colour.
- Don't remove mandatory non-advice / non-accreditation wording from any output.
- Don't ship UI-only "permissions" — every gated control must be backed by server enforcement.
