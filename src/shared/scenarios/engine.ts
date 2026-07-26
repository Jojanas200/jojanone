// Scenario questionnaire engine. Each scenario carries typed, optionally
// conditional questions; generateScenarioResult() turns the answers into a
// deterministic advisory result (readiness, impact, risks, prioritised
// actions, documents, deadlines, professional-support callout). Framework-free
// so the server computes the stored result and the client can re-render it.
import type { ScenarioType } from "../schemas/scenarios";

export type ScenarioAnswers = Record<string, string | number | boolean>;

export type QuestionType = "boolean" | "text" | "number" | "date" | "select";

export interface ScenarioQuestion {
  key: string;
  label: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  hint?: string;
  /** Only asked when a previous answer matches. */
  showIf?: { key: string; equals: string | boolean };
  /** For boolean questions: what it means when NOT handled. */
  risk?: string;
  action?: { label: string; priority: "high" | "medium"; module: string };
  doc?: string;
}

export interface ScenarioResult {
  readiness: number;
  handled: number;
  total: number;
  outstanding: string[];
  impact: "low" | "medium" | "high";
  summary: string;
  affectedModules: string[];
  considerations: string[];
  risks: string[];
  actions: { label: string; priority: "high" | "medium"; module: string }[];
  documents: string[];
  deadlines: string[];
  professionalSupport: string | null;
}

interface Extra {
  risks?: string[];
  actions?: ScenarioResult["actions"];
  documents?: string[];
  deadlines?: string[];
  considerations?: string[];
  professionalSupport?: string;
  impactHigh?: boolean;
}

interface ScenarioDef {
  label: string;
  category: string;
  tagline: string;
  modules: string[];
  questions: ScenarioQuestion[];
  summary: (a: ScenarioAnswers) => string;
  rules?: (a: ScenarioAnswers) => Extra;
}

const yes = (a: ScenarioAnswers, k: string) => a[k] === true;
const str = (a: ScenarioAnswers, k: string) =>
  typeof a[k] === "string" ? (a[k] as string) : "";
const num = (a: ScenarioAnswers, k: string) =>
  typeof a[k] === "number" ? (a[k] as number) : Number(a[k]) || 0;

export const SCENARIO_DEFS: Record<ScenarioType, ScenarioDef> = {
  hire_employee: {
    label: "Hire an employee",
    category: "People",
    tagline: "From offer to first day, compliantly.",
    modules: ["hr", "compliance", "policies"],
    questions: [
      { key: "role", label: "What is the role?", type: "text", required: true },
      { key: "start_date", label: "Planned start date", type: "date" },
      {
        key: "employment_type",
        label: "Employment type",
        type: "select",
        options: ["full_time", "part_time", "fixed_term", "apprentice"],
        required: true,
      },
      {
        key: "works_with_children",
        label: "Will the role work with children or vulnerable adults?",
        type: "boolean",
      },
      {
        key: "rtw",
        label: "Right-to-work check completed",
        type: "boolean",
        risk: "Employing someone without a right-to-work check risks civil penalties up to £60,000 per worker.",
        action: {
          label: "Complete a right-to-work check",
          priority: "high",
          module: "hr",
        },
      },
      {
        key: "contract",
        label: "Written statement / contract issued",
        type: "boolean",
        risk: "A written statement of particulars is due by day one of employment.",
        action: {
          label: "Issue the written statement / contract",
          priority: "high",
          module: "hr",
        },
        doc: "Employment contract / written statement",
      },
      {
        key: "payroll",
        label: "Payroll and PAYE set up",
        type: "boolean",
        risk: "PAYE must be registered before the first payday.",
        action: {
          label: "Register / update PAYE and payroll",
          priority: "high",
          module: "compliance",
        },
      },
      {
        key: "pension",
        label: "Auto-enrolment pension assessed",
        type: "boolean",
        risk: "Auto-enrolment duties start on the first day of employment.",
        action: {
          label: "Assess auto-enrolment duties",
          priority: "medium",
          module: "compliance",
        },
      },
      {
        key: "insurance",
        label: "Employers' liability insurance in place",
        type: "boolean",
        risk: "Employers' liability insurance is a legal requirement once you employ staff.",
        action: {
          label: "Confirm employers' liability cover",
          priority: "high",
          module: "compliance",
        },
      },
      {
        key: "policies",
        label: "Key policies shared (handbook, H&S)",
        type: "boolean",
        risk: "New starters need the policies that govern their work.",
        action: {
          label: "Share the staff handbook and key policies",
          priority: "medium",
          module: "policies",
        },
        doc: "Staff handbook",
      },
    ],
    summary: (a) =>
      `Hiring ${str(a, "role") || "a new employee"} (${str(a, "employment_type").replace(/_/g, " ") || "employment"}${str(a, "start_date") ? `, starting ${str(a, "start_date")}` : ""}).`,
    rules: (a) => {
      const extra: Extra = {};
      if (yes(a, "works_with_children")) {
        extra.risks = [
          "The role involves children or vulnerable adults - a DBS check is likely required before unsupervised work.",
        ];
        extra.actions = [
          {
            label: "Arrange an appropriate DBS check",
            priority: "high",
            module: "hr",
          },
        ];
        extra.impactHigh = true;
      }
      if (str(a, "employment_type") === "fixed_term")
        extra.considerations = [
          "Fixed-term employees have the right to no less favourable treatment than comparable permanent staff.",
        ];
      if (str(a, "start_date"))
        extra.deadlines = [
          `Written statement due by ${str(a, "start_date")} (day one)`,
        ];
      return extra;
    },
  },
  engage_contractor: {
    label: "Engage a contractor",
    category: "People",
    tagline: "Status, contract and IP - settled before work starts.",
    modules: ["hr", "contracts"],
    questions: [
      {
        key: "role",
        label: "What will the contractor do?",
        type: "text",
        required: true,
      },
      {
        key: "ir35",
        label: "IR35 / employment status assessment outcome",
        type: "select",
        options: ["outside", "inside", "not_assessed"],
        required: true,
      },
      {
        key: "engagement_length",
        label: "Engagement length",
        type: "select",
        options: ["under_3_months", "3_to_12_months", "over_12_months"],
      },
      {
        key: "contract",
        label: "Contractor agreement signed",
        type: "boolean",
        risk: "Working without a signed agreement leaves scope, payment and liability unclear.",
        action: {
          label: "Sign a contractor agreement",
          priority: "high",
          module: "contracts",
        },
        doc: "Contractor agreement",
      },
      {
        key: "insurance",
        label: "Contractor insurance verified",
        type: "boolean",
        risk: "Uninsured contractor errors can land on your business.",
        action: {
          label: "Verify the contractor's insurance",
          priority: "medium",
          module: "contracts",
        },
      },
      {
        key: "ip",
        label: "IP ownership addressed",
        type: "boolean",
        risk: "Without an assignment clause, contractors own the IP they create by default.",
        action: {
          label: "Add an IP assignment clause",
          priority: "high",
          module: "contracts",
        },
      },
    ],
    summary: (a) =>
      `Engaging a contractor for ${str(a, "role") || "a project"} (IR35: ${str(a, "ir35").replace(/_/g, " ") || "not assessed"}).`,
    rules: (a) => {
      const extra: Extra = {};
      if (str(a, "ir35") === "inside") {
        extra.risks = [
          "Inside IR35: PAYE and NIC are due on the engagement - payroll treatment applies.",
        ];
        extra.actions = [
          {
            label: "Run the engagement through payroll (deemed employment)",
            priority: "high",
            module: "compliance",
          },
        ];
        extra.impactHigh = true;
      }
      if (str(a, "ir35") === "not_assessed") {
        extra.risks = [
          "Employment status has not been assessed - misclassification creates back-tax risk.",
        ];
        extra.actions = [
          {
            label: "Complete an employment-status (CEST) assessment",
            priority: "high",
            module: "hr",
          },
        ];
        extra.professionalSupport =
          "Status determinations for borderline cases benefit from professional advice.";
      }
      if (str(a, "engagement_length") === "over_12_months")
        extra.considerations = [
          "Long engagements drift toward employment in practice - re-check status periodically.",
        ];
      return extra;
    },
  },
  new_customer: {
    label: "Take on a new customer",
    category: "Growth",
    tagline: "Agree terms before the work, not after.",
    modules: ["contracts", "business-map"],
    questions: [
      {
        key: "customer_name",
        label: "Customer name",
        type: "text",
        required: true,
      },
      {
        key: "contract_value",
        label: "Expected annual value (£)",
        type: "number",
      },
      {
        key: "terms",
        label: "Contract / terms of business agreed",
        type: "boolean",
        risk: "Working without agreed terms makes payment and scope disputes hard to win.",
        action: {
          label: "Agree written terms before starting",
          priority: "high",
          module: "contracts",
        },
        doc: "Terms of business",
      },
      {
        key: "credit",
        label: "Credit check / payment terms set",
        type: "boolean",
        risk: "Unchecked credit on a large account concentrates cash-flow risk.",
        action: {
          label: "Run a credit check and set payment terms",
          priority: "medium",
          module: "contracts",
        },
      },
      {
        key: "personal_data",
        label: "Will you process personal data for this customer?",
        type: "boolean",
      },
      {
        key: "dpa",
        label: "Data sharing / DPA in place",
        type: "boolean",
        showIf: { key: "personal_data", equals: true },
        risk: "Processing customer personal data without a DPA breaches UK GDPR contract requirements.",
        action: {
          label: "Put a data processing agreement in place",
          priority: "high",
          module: "gdpr",
        },
        doc: "Data processing agreement",
      },
      {
        key: "onboarding",
        label: "Onboarding and delivery plan agreed",
        type: "boolean",
        risk: "No delivery plan is the most common cause of early disputes.",
        action: {
          label: "Agree the onboarding / delivery plan",
          priority: "medium",
          module: "contracts",
        },
      },
    ],
    summary: (a) =>
      `Taking on ${str(a, "customer_name") || "a new customer"}${num(a, "contract_value") ? ` worth ~£${num(a, "contract_value").toLocaleString("en-GB")}/yr` : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (num(a, "contract_value") >= 50000) {
        extra.considerations = [
          "A large account: consider concentration risk and whether dependency on this customer needs managing.",
        ];
        extra.impactHigh = true;
      }
      if (yes(a, "personal_data"))
        extra.considerations = [
          ...(extra.considerations ?? []),
          "Record this processing in your ROPA.",
        ];
      return extra;
    },
  },
  new_supplier: {
    label: "Onboard a new supplier",
    category: "Growth",
    tagline: "Due diligence before dependency.",
    modules: ["contracts", "business-map"],
    questions: [
      {
        key: "supplier_name",
        label: "Supplier name",
        type: "text",
        required: true,
      },
      {
        key: "critical",
        label: "Would your business stop if this supplier failed?",
        type: "boolean",
      },
      {
        key: "contract",
        label: "Supplier contract in place",
        type: "boolean",
        risk: "No contract means no service levels, no exit terms and no leverage.",
        action: {
          label: "Put a supplier contract in place",
          priority: "high",
          module: "contracts",
        },
        doc: "Supplier agreement",
      },
      {
        key: "dd",
        label: "Due diligence completed",
        type: "boolean",
        risk: "Skipping due diligence risks financial, quality and reputational exposure.",
        action: {
          label: "Complete supplier due diligence",
          priority: "medium",
          module: "business-map",
        },
      },
      {
        key: "shares_data",
        label: "Will the supplier process personal data for you?",
        type: "boolean",
      },
      {
        key: "dpa",
        label: "Data processing agreement signed",
        type: "boolean",
        showIf: { key: "shares_data", equals: true },
        risk: "A processor without a DPA is a UK GDPR breach on your side.",
        action: {
          label: "Sign a DPA with the supplier",
          priority: "high",
          module: "gdpr",
        },
        doc: "Data processing agreement",
      },
    ],
    summary: (a) =>
      `Onboarding ${str(a, "supplier_name") || "a new supplier"}${yes(a, "critical") ? " (business-critical)" : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (yes(a, "critical")) {
        extra.risks = [
          "Single-supplier dependency: failure would stop your business.",
        ];
        extra.actions = [
          {
            label: "Identify a fallback supplier or exit plan",
            priority: "high",
            module: "risk",
          },
        ];
        extra.impactHigh = true;
      }
      if (yes(a, "shares_data"))
        extra.considerations = [
          "Add the supplier to your processor list in the ROPA.",
        ];
      return extra;
    },
  },
  launch_website: {
    label: "Launch a website",
    category: "Digital",
    tagline: "Privacy, cookies and terms - live before you are.",
    modules: ["gdpr", "policies"],
    questions: [
      {
        key: "collects_data",
        label:
          "Will the site collect personal data (forms, accounts, analytics)?",
        type: "boolean",
      },
      {
        key: "privacy",
        label: "Privacy notice published",
        type: "boolean",
        risk: "Collecting data without a privacy notice breaches UK GDPR transparency rules.",
        action: {
          label: "Publish a privacy notice",
          priority: "high",
          module: "gdpr",
        },
        doc: "Privacy notice",
      },
      {
        key: "cookies",
        label: "Cookie consent implemented",
        type: "boolean",
        risk: "Non-essential cookies need consent before they are set (PECR).",
        action: {
          label: "Implement cookie consent",
          priority: "medium",
          module: "gdpr",
        },
      },
      {
        key: "terms",
        label: "Website terms of use published",
        type: "boolean",
        risk: "Without terms of use you have no stated rules for visitors or liability position.",
        action: {
          label: "Publish website terms of use",
          priority: "medium",
          module: "policies",
        },
        doc: "Website terms of use",
      },
      {
        key: "accessibility",
        label: "Accessibility considered",
        type: "boolean",
        risk: "Inaccessible sites exclude users and invite Equality Act complaints.",
        action: {
          label: "Run an accessibility check (WCAG)",
          priority: "medium",
          module: "policies",
        },
      },
      {
        key: "sells_online",
        label: "Will you sell to consumers online?",
        type: "boolean",
      },
    ],
    summary: (a) =>
      `Launching a website${yes(a, "sells_online") ? " with online sales" : ""}${yes(a, "collects_data") ? ", collecting personal data" : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (yes(a, "sells_online")) {
        extra.considerations = [
          "Consumer online sales trigger the Consumer Contracts Regulations: pre-contract information and 14-day cancellation rights.",
        ];
        extra.documents = ["Consumer terms & cancellation policy"];
      }
      return extra;
    },
  },
  expand_market: {
    label: "Expand to a new market",
    category: "Growth",
    tagline: "New region, new rules.",
    modules: ["compliance", "gdpr", "contracts"],
    questions: [
      {
        key: "region",
        label: "Target region",
        type: "select",
        options: ["uk_other_nation", "eu", "usa", "other_international"],
        required: true,
      },
      {
        key: "physical_presence",
        label: "Will you have staff or premises there?",
        type: "boolean",
      },
      {
        key: "regulatory",
        label: "Local regulatory requirements reviewed",
        type: "boolean",
        risk: "Trading rules, licensing and tax differ by market.",
        action: {
          label: "Review the target market's regulatory requirements",
          priority: "high",
          module: "compliance",
        },
      },
      {
        key: "contracts_reviewed",
        label: "Contract templates reviewed for the new market",
        type: "boolean",
        risk: "UK-law templates may not protect you abroad.",
        action: {
          label: "Review contract templates for the new market",
          priority: "medium",
          module: "contracts",
        },
      },
      {
        key: "transfers",
        label: "International data transfers assessed",
        type: "boolean",
        showIf: { key: "region", equals: "usa" },
        risk: "Transfers outside the UK need a lawful transfer mechanism (adequacy or safeguards).",
        action: {
          label: "Put transfer safeguards (IDTA/SCCs) in place",
          priority: "high",
          module: "gdpr",
        },
      },
    ],
    summary: (a) =>
      `Expanding into ${str(a, "region").replace(/_/g, " ") || "a new market"}${yes(a, "physical_presence") ? " with local presence" : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (str(a, "region") === "eu")
        extra.considerations = [
          "Serving EU customers can bring EU GDPR into scope alongside UK GDPR - you may need an EU representative.",
        ];
      if (yes(a, "physical_presence")) {
        extra.professionalSupport =
          "Local employment and tax registration usually needs professional advice in the target market.";
        extra.impactHigh = true;
      }
      return extra;
    },
  },
  raise_investment: {
    label: "Raise investment",
    category: "Finance",
    tagline: "Be diligence-ready before the term sheet.",
    modules: ["investor-ready", "governance"],
    questions: [
      { key: "amount", label: "Amount you plan to raise (£)", type: "number" },
      {
        key: "instrument",
        label: "Instrument",
        type: "select",
        options: ["equity", "convertible", "debt", "undecided"],
      },
      {
        key: "records",
        label: "Statutory registers and filings up to date",
        type: "boolean",
        risk: "Out-of-date filings are the first thing diligence finds.",
        action: {
          label: "Bring Companies House filings up to date",
          priority: "high",
          module: "compliance",
        },
      },
      {
        key: "data_room",
        label: "Data room prepared",
        type: "boolean",
        risk: "A scrambled data room slows the round and weakens your position.",
        action: {
          label: "Build the data room",
          priority: "medium",
          module: "investor-ready",
        },
      },
      {
        key: "cap_table",
        label: "Cap table clean and agreed",
        type: "boolean",
        risk: "Cap-table disputes surface at the worst possible moment.",
        action: {
          label: "Confirm the cap table with all holders",
          priority: "high",
          module: "investor-ready",
        },
        doc: "Cap table",
      },
      {
        key: "board_approval",
        label: "Board/shareholder approvals mapped",
        type: "boolean",
        risk: "Issuing shares needs the right authorities and resolutions.",
        action: {
          label: "Record the approvals in governance",
          priority: "medium",
          module: "governance",
        },
      },
    ],
    summary: (a) =>
      `Raising ${num(a, "amount") ? `£${num(a, "amount").toLocaleString("en-GB")}` : "investment"}${str(a, "instrument") && str(a, "instrument") !== "undecided" ? ` via ${str(a, "instrument")}` : ""}.`,
    rules: (a) => {
      const extra: Extra = {
        professionalSupport:
          "Investment rounds need a solicitor for the subscription/shareholder agreements.",
      };
      if (num(a, "amount") >= 250000) extra.impactHigh = true;
      if (str(a, "instrument") === "equity")
        extra.considerations = [
          "Check SEIS/EIS eligibility early - assurance helps investors commit.",
        ];
      return extra;
    },
  },
  prepare_tender: {
    label: "Prepare a tender",
    category: "Growth",
    tagline: "Bid decisions on evidence, not optimism.",
    modules: ["tender-ready", "policies"],
    questions: [
      { key: "authority", label: "Who is the buyer?", type: "text" },
      { key: "deadline", label: "Submission deadline", type: "date" },
      {
        key: "eligibility",
        label: "Eligibility criteria reviewed",
        type: "boolean",
        risk: "Bidding while ineligible wastes the whole effort.",
        action: {
          label: "Check eligibility before writing anything",
          priority: "high",
          module: "tender-ready",
        },
      },
      {
        key: "policies_ready",
        label: "Required policies current",
        type: "boolean",
        risk: "Tenders routinely require current H&S, environmental and equality policies.",
        action: {
          label: "Refresh the policies the tender requires",
          priority: "medium",
          module: "policies",
        },
      },
      {
        key: "evidence",
        label: "Case studies / references ready",
        type: "boolean",
        risk: "Evidence gaps lose marks that price cannot recover.",
        action: {
          label: "Assemble case studies and references",
          priority: "medium",
          module: "tender-ready",
        },
      },
      {
        key: "bid_decision",
        label: "Bid/no-bid decision made",
        type: "boolean",
        risk: "Without a bid decision, effort leaks into unwinnable tenders.",
        action: {
          label: "Run the bid/no-bid assessment",
          priority: "high",
          module: "tender-ready",
        },
      },
    ],
    summary: (a) =>
      `Preparing a tender${str(a, "authority") ? ` for ${str(a, "authority")}` : ""}${str(a, "deadline") ? `, due ${str(a, "deadline")}` : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (str(a, "deadline"))
        extra.deadlines = [`Submission deadline ${str(a, "deadline")}`];
      return extra;
    },
  },
  introduce_ai: {
    label: "Introduce AI tools",
    category: "Digital",
    tagline: "Adopt AI with guardrails, not surprises.",
    modules: ["gdpr", "policies", "risk"],
    questions: [
      {
        key: "use_case",
        label: "What will AI be used for?",
        type: "text",
        required: true,
      },
      {
        key: "personal_data",
        label: "Will personal data go into the tool?",
        type: "boolean",
      },
      {
        key: "policy",
        label: "AI use policy in place",
        type: "boolean",
        risk: "Without a policy, staff decide alone what goes into AI tools.",
        action: {
          label: "Adopt an AI use policy",
          priority: "high",
          module: "policies",
        },
        doc: "AI use policy",
      },
      {
        key: "dpia",
        label: "DPIA / data assessment done",
        type: "boolean",
        showIf: { key: "personal_data", equals: true },
        risk: "Personal data in AI tools is high-risk processing - a DPIA is expected.",
        action: {
          label: "Complete a DPIA for the AI use",
          priority: "high",
          module: "gdpr",
        },
      },
      {
        key: "vendor_terms",
        label: "Vendor terms reviewed (training on your data?)",
        type: "boolean",
        risk: "Some AI vendors train on customer inputs by default.",
        action: {
          label: "Review vendor terms for data usage",
          priority: "medium",
          module: "contracts",
        },
      },
      {
        key: "human_review",
        label: "Human review of AI output in place",
        type: "boolean",
        risk: "Unreviewed AI output carries accuracy and bias risk into your business.",
        action: {
          label: "Require human review of significant outputs",
          priority: "medium",
          module: "risk",
        },
      },
    ],
    summary: (a) =>
      `Introducing AI for ${str(a, "use_case") || "business use"}${yes(a, "personal_data") ? ", involving personal data" : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (yes(a, "personal_data")) extra.impactHigh = true;
      return extra;
    },
  },
  new_personal_data: {
    label: "Process new personal data",
    category: "Compliance",
    tagline: "New data, lawful from day one.",
    modules: ["gdpr"],
    questions: [
      {
        key: "data_description",
        label: "What data, about whom?",
        type: "text",
        required: true,
      },
      {
        key: "special_category",
        label:
          "Does it include special category data (health, biometrics, etc.)?",
        type: "boolean",
      },
      {
        key: "lawful_basis",
        label: "Lawful basis identified",
        type: "boolean",
        risk: "Processing without a lawful basis is the core UK GDPR breach.",
        action: {
          label: "Identify and document the lawful basis",
          priority: "high",
          module: "gdpr",
        },
      },
      {
        key: "ropa",
        label: "Added to your ROPA",
        type: "boolean",
        risk: "Undocumented processing undermines accountability.",
        action: {
          label: "Record the activity in your ROPA",
          priority: "medium",
          module: "gdpr",
        },
      },
      {
        key: "notice",
        label: "Privacy notice covers this processing",
        type: "boolean",
        risk: "People must be told what you do with their data.",
        action: {
          label: "Update the privacy notice",
          priority: "medium",
          module: "gdpr",
        },
        doc: "Privacy notice update",
      },
      {
        key: "retention",
        label: "Retention period set",
        type: "boolean",
        risk: "Keeping data forever is itself a breach.",
        action: {
          label: "Set a retention period",
          priority: "medium",
          module: "gdpr",
        },
      },
    ],
    summary: (a) =>
      `New processing: ${str(a, "data_description") || "personal data"}${yes(a, "special_category") ? " (special category)" : ""}.`,
    rules: (a) => {
      const extra: Extra = {};
      if (yes(a, "special_category")) {
        extra.risks = [
          "Special category data needs an Article 9 condition on top of the lawful basis.",
        ];
        extra.actions = [
          {
            label: "Identify the Article 9 condition",
            priority: "high",
            module: "gdpr",
          },
        ];
        extra.impactHigh = true;
        extra.professionalSupport =
          "Special-category processing at scale merits data-protection advice.";
      }
      return extra;
    },
  },
};

/** Questions that currently apply given the answers so far. */
export function applicableQuestions(
  type: ScenarioType,
  answers: ScenarioAnswers,
): ScenarioQuestion[] {
  return SCENARIO_DEFS[type].questions.filter(
    (q) => !q.showIf || answers[q.showIf.key] === q.showIf.equals,
  );
}

export function generateScenarioResult(
  type: ScenarioType,
  answers: ScenarioAnswers,
): ScenarioResult {
  const def = SCENARIO_DEFS[type];
  const asked = applicableQuestions(type, answers);
  const checks = asked.filter(
    (q) => q.type === "boolean" && (q.risk || q.action),
  );
  const handled = checks.filter((q) => answers[q.key] === true);
  const unhandled = checks.filter((q) => answers[q.key] !== true);

  const extra = def.rules?.(answers) ?? {};
  const risks = [
    ...unhandled.flatMap((q) => (q.risk ? [q.risk] : [])),
    ...(extra.risks ?? []),
  ];
  const actions = [
    ...unhandled.flatMap((q) => (q.action ? [q.action] : [])),
    ...(extra.actions ?? []),
  ].sort((a, b) =>
    a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1,
  );
  const documents = [
    ...unhandled.flatMap((q) => (q.doc ? [q.doc] : [])),
    ...(extra.documents ?? []),
  ];
  const total = checks.length;
  const readiness =
    total === 0 ? 100 : Math.round((handled.length / total) * 100);
  const impact: ScenarioResult["impact"] =
    extra.impactHigh || actions.filter((x) => x.priority === "high").length >= 3
      ? "high"
      : readiness >= 80
        ? "low"
        : "medium";

  return {
    readiness,
    handled: handled.length,
    total,
    outstanding: unhandled.map((q) => q.label),
    impact,
    summary: def.summary(answers),
    affectedModules: Array.from(
      new Set([...def.modules, ...actions.map((x) => x.module)]),
    ),
    considerations: extra.considerations ?? [],
    risks,
    actions,
    documents,
    deadlines: extra.deadlines ?? [],
    professionalSupport: extra.professionalSupport ?? null,
  };
}
