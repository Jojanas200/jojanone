# Privacy Notice & DPIA (screening) — Jojan One

_Updated 2026-07-18. This is the M6 privacy artifact: a controller-side record and a DPIA screening. It is **not** legal advice; a DPO / solicitor sign-off is an open item before launch._

## 1. Roles

- **Jojan One is a data processor** for the personal data our customers put into their workspaces (their employees, customers, suppliers), and a **controller** for account/billing data of our direct users.
- Customers are controllers for the personal data in their workspace.
- A **Data Processing Agreement** with each customer, and with each sub-processor, is required before launch (open item).

## 2. Personal data processed

| Category | Examples | Basis (ours, as controller) | Location |
|---|---|---|---|
| Account data | name, email, workspace | Contract | Supabase eu-west-2 |
| Billing data | Stripe customer/subscription ids | Contract / legal obligation | Stripe + our `subscriptions` |
| Customer workspace data (we process) | employee RTW/training, contract counterparties, ROPA subjects | Set by the customer-controller | Supabase eu-west-2 |
| Special-category (possible) | health/absence in HR, special-category flags in GDPR module | Customer's responsibility; we provide review tooling | Supabase eu-west-2 |
| Support/AI content | Jova conversation turns | Contract / legitimate interests | Supabase; AI provider at inference time only |

## 3. Sub-processors

| Sub-processor | Purpose | Data | DPA needed |
|---|---|---|---|
| Supabase (AWS eu-west-2) | Database, auth, storage | All workspace data | ✅ before launch |
| Stripe | Payments | Billing identifiers, card data (Stripe-side) | ✅ |
| Companies House API | Public company lookups | Company numbers (public data) | Read-only public data |
| Anthropic **or** OpenRouter | AI assistant (one active) | Retrieved workspace context at inference | ✅ per provider shipped; **no training on customer data**; regional processing to confirm |
| Resend (or chosen email provider) | Transactional email | Recipient email, invite/reminder content | ✅ |

## 4. DPIA screening

A full DPIA is required where processing is "likely to result in a high risk". Screening:

| Trigger | Present? | Note |
|---|---|---|
| Systematic/extensive profiling with legal effects | No | Jova gives guidance, not automated decisions with legal effect; every AI answer is labelled "guidance, not advice" and regulated judgement is refused/escalated |
| Large-scale special-category processing | Possibly (customer-dependent) | HR/GDPR modules can hold special-category data → **full DPIA recommended** for customers who enable those modules at scale |
| Large-scale systematic monitoring | No | |
| Automated decision-making under Art. 22 | No | No solely-automated decisions; user acts on findings |

**Outcome:** a full DPIA is **recommended** and should be completed with a DPO before onboarding customers who process special-category data at scale. The AI layer's design (RLS-bounded retrieval, deterministic fallback, refusal/escalation, no training on customer data, full provenance logging) materially lowers the AI-specific risk.

## 5. Data-subject rights (how the product supports them)

- **Access/portability:** the Reports module exports every register as CSV; a per-subject export is an open item.
- **Erasure:** soft-delete in registers + workspace cascade delete; a documented erasure SOP is an open item.
- **Rectification:** every record is editable in its module.
- **Restriction/objection:** handled operationally; SOP is an open item.

## 6. Open items

- [ ] DPO / legal review and sign-off of this notice + DPIA.
- [ ] Execute DPAs with Supabase, Stripe, the AI provider, and the email provider.
- [ ] Publish a customer-facing privacy policy + cookie notice.
- [ ] Confirm AI-provider regional processing and no-training terms in writing.
- [ ] Data-subject-request SOP (access/erasure/rectification) with response SLAs.
