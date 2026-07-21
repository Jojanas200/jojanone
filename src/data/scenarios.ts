import type { ModuleKey, ScenarioResult, ScenarioType } from "./types";

export interface ScenarioQuestion {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "boolean";
  options?: string[];
  required?: boolean;
  help?: string;
  showIf?: (a: Record<string, unknown>) => boolean;
}

export interface ScenarioDefinition {
  type: ScenarioType;
  title: string;
  category: "People" | "Growth" | "Compliance" | "Digital" | "Finance";
  tagline: string;
  icon_key: string;
  questions: ScenarioQuestion[];
  generate: (answers: Record<string, unknown>) => ScenarioResult;
}

const yn = ["Yes", "No"];

function base(answers: Record<string, unknown>) {
  return {
    isYes: (k: string) => answers[k] === "Yes" || answers[k] === true,
    val: (k: string) => (answers[k] as string) ?? "",
  };
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    type: "hire_employee",
    title: "Hiring an employee",
    category: "People",
    tagline: "Model the impact of adding an employee to your business.",
    icon_key: "user-plus",
    questions: [
      {
        key: "role",
        label: "Proposed role title",
        type: "text",
        required: true,
      },
      {
        key: "employment_type",
        label: "Employment type",
        type: "select",
        options: ["Permanent", "Fixed-term", "Part-time"],
        required: true,
      },
      {
        key: "start_date",
        label: "Intended start date",
        type: "date",
        required: true,
      },
      {
        key: "drives",
        label: "Will they drive on company business?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "vulnerable",
        label: "Will they work with vulnerable people?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "screening",
        label: "Is background screening required?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "accesses_personal_data",
        label: "Will they access personal data?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "contract_ready",
        label: "Is a contract of employment ready?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "right_to_work_ready",
        label: "Has right-to-work evidence been collected?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "training_required",
        label: "Is any induction training required?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const gaps: string[] = [];
      const actions: ScenarioResult["required_actions"] = [];
      if (!isYes("contract_ready")) {
        gaps.push("Employment contract not ready.");
        actions.push({
          label: `Draft employment contract for ${val("role") || "new hire"}`,
          module: "contracts",
          priority: "high",
        });
      }
      if (!isYes("right_to_work_ready")) {
        gaps.push("Right-to-work evidence outstanding.");
        actions.push({
          label: "Complete and record right-to-work check",
          module: "hr",
          priority: "high",
        });
      }
      if (isYes("vulnerable") || isYes("screening")) {
        gaps.push("Background / DBS screening required.");
        actions.push({
          label: "Arrange DBS or vetting check",
          module: "hr",
          priority: "high",
        });
      }
      if (isYes("accesses_personal_data")) {
        actions.push({
          label: "Add data protection training",
          module: "hr",
          priority: "medium",
        });
      }
      if (isYes("training_required")) {
        actions.push({
          label: "Schedule induction training",
          module: "hr",
          priority: "medium",
        });
      }
      if (isYes("drives")) {
        gaps.push("Driving check and insurance cover needed.");
        actions.push({
          label: "Verify driving licence and insurance cover",
          module: "risk",
          priority: "medium",
        });
      }
      const impact: ScenarioResult["impact_level"] =
        gaps.length >= 3 ? "high" : gaps.length >= 1 ? "medium" : "low";
      const readiness: ScenarioResult["readiness"] =
        gaps.length >= 3
          ? "significant_gaps"
          : gaps.length >= 1
            ? "gaps"
            : "ready";
      return {
        summary: `Hiring ${val("role") || "a new employee"} as ${val("employment_type").toLowerCase() || "an employee"} triggers employment law, HR administration and data protection obligations.`,
        readiness,
        impact_level: impact,
        affected_modules: ["hr", "contracts", "gdpr", "compliance"],
        considerations: [
          "Written statement of particulars is required from day one.",
          "Right-to-work check must be recorded before employment begins.",
          "New hire should be added to payroll and pension auto-enrolment.",
        ],
        risks: gaps.length
          ? gaps
          : ["Standard employment risks - none unusual identified."],
        required_actions: actions.length
          ? actions
          : [
              {
                label: "Add employee to HR register",
                module: "hr",
                priority: "medium",
              },
            ],
        recommended_documents: [
          "Employment contract",
          "Right-to-work record",
          "Handbook acknowledgement",
          "Data protection notice",
        ],
        suggested_deadlines: [
          "Employment contract issued before start date",
          "Right-to-work check on or before day one",
          "Probation review within 3 months of start",
        ],
        professional_support: gaps.includes(
          "Background / DBS screening required.",
        )
          ? ["Speak to a screening provider for regulated roles."]
          : [
              "Speak to an employment solicitor if bespoke restrictive covenants are needed.",
            ],
      };
    },
  },
  {
    type: "engage_contractor",
    title: "Engaging a contractor",
    category: "People",
    tagline: "Assess IR35 status, contract needs and dependency risk.",
    icon_key: "briefcase",
    questions: [
      { key: "role", label: "Contractor role", type: "text", required: true },
      {
        key: "duration",
        label: "Expected engagement length",
        type: "select",
        options: ["< 3 months", "3–12 months", "> 12 months"],
        required: true,
      },
      {
        key: "sole_supplier",
        label: "Will this be their only client?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "control",
        label: "Do you control how they perform the work?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "personal_data",
        label: "Will they access personal data?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "contract_ready",
        label: "Is a written contractor agreement ready?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const insideIR35 = isYes("sole_supplier") || isYes("control");
      const actions: ScenarioResult["required_actions"] = [];
      if (!isYes("contract_ready"))
        actions.push({
          label: `Issue contractor agreement for ${val("role")}`,
          module: "contracts",
          priority: "high",
        });
      if (insideIR35)
        actions.push({
          label: "Record IR35 Status Determination Statement",
          module: "hr",
          priority: "high",
        });
      if (isYes("personal_data"))
        actions.push({
          label: "Add processor DPA clause or standalone DPA",
          module: "contracts",
          priority: "medium",
        });
      actions.push({
        label: "Add contractor to Business Map",
        module: "business-map",
        priority: "medium",
      });
      return {
        summary: `Engaging a contractor for ${val("role")} - key risks are IR35 status and data protection obligations.`,
        readiness:
          insideIR35 || !isYes("contract_ready") ? "gaps" : "mostly_ready",
        impact_level: insideIR35 ? "medium" : "low",
        affected_modules: ["contracts", "hr", "gdpr", "business-map"],
        considerations: [
          insideIR35
            ? "Working pattern points towards inside-IR35 - deemed employment risk."
            : "Working pattern points towards outside-IR35 - evidence the SDS.",
          "Ensure a signed contractor agreement is on file.",
        ],
        risks: insideIR35
          ? ["HMRC deemed-employment challenge risk."]
          : ["Standard contracting risks."],
        required_actions: actions,
        recommended_documents: [
          "Contractor agreement",
          "IR35 SDS",
          isYes("personal_data") ? "Data processing addendum" : "",
        ].filter(Boolean) as string[],
        suggested_deadlines: [
          "Agreement signed before work begins",
          "SDS reviewed annually",
        ],
        professional_support: insideIR35
          ? ["Speak to an employment tax adviser on IR35 position."]
          : [],
      };
    },
  },
  {
    type: "new_customer",
    title: "Signing a new customer",
    category: "Growth",
    tagline: "Check contract, data-protection and dependency implications.",
    icon_key: "handshake",
    questions: [
      {
        key: "customer_name",
        label: "Customer name",
        type: "text",
        required: true,
      },
      {
        key: "annual_value",
        label: "Annual contract value (£)",
        type: "text",
        required: true,
      },
      {
        key: "public_sector",
        label: "Is the customer a public body?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "personal_data",
        label: "Will you process personal data on their behalf?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "international",
        label: "Does the engagement involve overseas work?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "contract_type",
        label: "Contract in place",
        type: "select",
        options: [
          "MSA + SoW",
          "Single agreement",
          "Purchase order only",
          "No written contract",
        ],
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (
        a.contract_type === "No written contract" ||
        a.contract_type === "Purchase order only"
      ) {
        actions.push({
          label: `Prepare written agreement for ${val("customer_name")}`,
          module: "contracts",
          priority: "high",
        });
      }
      if (isYes("personal_data")) {
        actions.push({
          label: "Sign data processing agreement",
          module: "contracts",
          priority: "high",
        });
        actions.push({
          label: "Update ROPA with new processing",
          module: "gdpr",
          priority: "medium",
        });
      }
      if (isYes("public_sector"))
        actions.push({
          label: "Confirm public procurement compliance evidence",
          module: "tender-ready",
          priority: "medium",
        });
      if (isYes("international"))
        actions.push({
          label: "Assess overseas tax and data-transfer implications",
          module: "compliance",
          priority: "medium",
        });
      actions.push({
        label: `Add ${val("customer_name")} to Business Map`,
        module: "business-map",
        priority: "medium",
      });
      return {
        summary: `New customer ${val("customer_name")} - expected value £${val("annual_value") || "0"}.`,
        readiness: actions.some((x) => x.priority === "high")
          ? "gaps"
          : "mostly_ready",
        impact_level:
          isYes("personal_data") || isYes("international") ? "medium" : "low",
        affected_modules: [
          "contracts",
          "gdpr",
          "business-map",
          isYes("public_sector") ? "tender-ready" : "compliance",
        ],
        considerations: [
          "Confirm counterparty due diligence (registration, VAT, insurance).",
          isYes("personal_data")
            ? "Processor obligations under UK GDPR apply."
            : "Confirm no personal data is exchanged in the engagement.",
        ],
        risks: isYes("international")
          ? ["Overseas tax and data-transfer risk."]
          : ["Standard customer-onboarding risks."],
        required_actions: actions,
        recommended_documents: [
          "Signed engagement letter",
          isYes("personal_data") ? "Data processing agreement" : "",
        ].filter(Boolean) as string[],
        suggested_deadlines: ["Written agreement signed before work begins"],
        professional_support: isYes("international")
          ? [
              "Consult a tax adviser on cross-border VAT and permanent establishment.",
            ]
          : [],
      };
    },
  },
  {
    type: "new_supplier",
    title: "Signing a new supplier",
    category: "Growth",
    tagline: "Check contract, dependency and data-processor risk.",
    icon_key: "truck",
    questions: [
      {
        key: "supplier_name",
        label: "Supplier name",
        type: "text",
        required: true,
      },
      {
        key: "annual_value",
        label: "Annual spend (£)",
        type: "text",
        required: true,
      },
      {
        key: "critical",
        label: "Is this supplier critical to operations?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "personal_data",
        label: "Will the supplier process personal data?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "contract_signed",
        label: "Is a supplier contract in place?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (!isYes("contract_signed"))
        actions.push({
          label: `Prepare supplier agreement with ${val("supplier_name")}`,
          module: "contracts",
          priority: "high",
        });
      if (isYes("personal_data"))
        actions.push({
          label: "Put DPA in place with supplier",
          module: "contracts",
          priority: "high",
        });
      if (isYes("critical"))
        actions.push({
          label: "Document contingency for supplier failure",
          module: "risk",
          priority: "medium",
        });
      actions.push({
        label: `Add ${val("supplier_name")} to Business Map`,
        module: "business-map",
        priority: "medium",
      });
      return {
        summary: `New supplier ${val("supplier_name")} - annual spend £${val("annual_value") || "0"}.`,
        readiness: isYes("contract_signed") ? "mostly_ready" : "gaps",
        impact_level: isYes("critical") ? "medium" : "low",
        affected_modules: [
          "contracts",
          "business-map",
          isYes("personal_data") ? "gdpr" : "risk",
        ],
        considerations: [
          "Confirm supplier is registered, insured and financially stable.",
          isYes("critical")
            ? "Critical suppliers should have a contingency plan."
            : "Non-critical supplier - standard checks apply.",
        ],
        risks: isYes("critical")
          ? ["Operational continuity risk if supplier fails."]
          : ["Low operational risk."],
        required_actions: actions,
        recommended_documents: [
          "Supplier agreement",
          isYes("personal_data") ? "Data processing agreement" : "",
        ].filter(Boolean) as string[],
        suggested_deadlines: ["Contract signed before supply begins"],
        professional_support: [],
      };
    },
  },
  {
    type: "launch_website",
    title: "Launching a website or digital service",
    category: "Digital",
    tagline: "Cover privacy notices, cookies, terms and accessibility.",
    icon_key: "globe",
    questions: [
      {
        key: "site_name",
        label: "Site or service name",
        type: "text",
        required: true,
      },
      {
        key: "collects_personal_data",
        label: "Does it collect personal data?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "cookies",
        label: "Does it use non-essential cookies or analytics?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "payments",
        label: "Does it take payments?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "accessible",
        label: "Have you tested against WCAG 2.2 AA?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (isYes("collects_personal_data"))
        actions.push({
          label: "Publish updated privacy notice",
          module: "gdpr",
          priority: "high",
        });
      if (isYes("cookies"))
        actions.push({
          label: "Deploy compliant cookie consent banner",
          module: "gdpr",
          priority: "high",
        });
      actions.push({
        label: "Publish website terms of use",
        module: "contracts",
        priority: "medium",
      });
      if (isYes("payments"))
        actions.push({
          label: "Confirm PCI scope and merchant terms",
          module: "risk",
          priority: "medium",
        });
      if (!isYes("accessible"))
        actions.push({
          label: "Complete WCAG 2.2 AA accessibility check",
          module: "risk",
          priority: "medium",
        });
      return {
        summary: `Launching ${val("site_name")}.`,
        readiness: actions.filter((x) => x.priority === "high").length
          ? "gaps"
          : "mostly_ready",
        impact_level:
          isYes("collects_personal_data") || isYes("payments")
            ? "medium"
            : "low",
        affected_modules: ["gdpr", "contracts", "risk"],
        considerations: [
          isYes("collects_personal_data")
            ? "GDPR Article 13 notice must be visible before data is collected."
            : "Publish minimal terms even if no data collected.",
          isYes("cookies")
            ? "PECR consent required for non-essential cookies."
            : "Only strictly-necessary cookies - no PECR consent needed.",
        ],
        risks: isYes("payments")
          ? ["Payment processing brings PCI DSS scope."]
          : ["Standard publishing risks."],
        required_actions: actions,
        recommended_documents: [
          "Privacy notice",
          "Cookie policy",
          "Website terms of use",
        ],
        suggested_deadlines: ["All notices live before public launch"],
        professional_support: isYes("payments")
          ? ["Speak to your payment provider on PCI scope."]
          : [],
      };
    },
  },
  {
    type: "expand_market",
    title: "Expanding into a new market",
    category: "Growth",
    tagline: "Assess tax, data-protection and contract implications.",
    icon_key: "globe-2",
    questions: [
      {
        key: "region",
        label: "Region",
        type: "select",
        options: [
          "EU",
          "US",
          "APAC",
          "Middle East",
          "Africa",
          "Other UK region",
        ],
        required: true,
      },
      {
        key: "establishment",
        label: "Will you set up an entity or office?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "hire_locally",
        label: "Will you hire people locally?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "transfer_data",
        label: "Will you transfer personal data across borders?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (isYes("establishment"))
        actions.push({
          label: "Assess entity registration and tax residency",
          module: "compliance",
          priority: "high",
        });
      if (isYes("hire_locally"))
        actions.push({
          label: "Review local employment law",
          module: "hr",
          priority: "high",
        });
      if (isYes("transfer_data"))
        actions.push({
          label: "Complete international data transfer risk assessment",
          module: "gdpr",
          priority: "high",
        });
      actions.push({
        label: `Add ${val("region")} adviser to Business Map`,
        module: "business-map",
        priority: "medium",
      });
      return {
        summary: `Expanding into ${val("region")}.`,
        readiness: "gaps",
        impact_level: "high",
        affected_modules: ["compliance", "hr", "gdpr", "risk", "business-map"],
        considerations: [
          "International expansion typically requires local professional advice.",
          isYes("transfer_data")
            ? "UK GDPR restricts personal data transfers outside the UK."
            : "No cross-border personal data - lower risk.",
        ],
        risks: ["Local regulatory exposure varies by jurisdiction."],
        required_actions: actions,
        recommended_documents: [
          "Market entry plan",
          "Local counsel engagement letter",
        ],
        suggested_deadlines: [],
        professional_support: [
          "Engage local counsel and a cross-border tax adviser before signing customers.",
        ],
      };
    },
  },
  {
    type: "raise_investment",
    title: "Raising investment",
    category: "Finance",
    tagline: "Prepare investor due diligence pack and governance.",
    icon_key: "trending-up",
    questions: [
      {
        key: "round_size",
        label: "Target round size (£)",
        type: "text",
        required: true,
      },
      {
        key: "seis_eis",
        label: "Using SEIS/EIS?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "dd_ready",
        label: "Is a data room ready?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (!isYes("dd_ready"))
        actions.push({
          label: "Prepare investor data room",
          module: "investor-ready",
          priority: "high",
        });
      if (isYes("seis_eis"))
        actions.push({
          label: "Apply for advance assurance",
          module: "compliance",
          priority: "medium",
        });
      actions.push({
        label: "Update cap table and board minutes",
        module: "governance",
        priority: "medium",
      });
      return {
        summary: `Raising £${val("round_size")} of investment.`,
        readiness: isYes("dd_ready") ? "mostly_ready" : "gaps",
        impact_level: "medium",
        affected_modules: ["investor-ready", "governance", "compliance"],
        considerations: [
          "Investor due diligence typically covers contracts, HR, IP and compliance.",
        ],
        risks: ["Regulatory disclosure obligations to shareholders."],
        required_actions: actions,
        recommended_documents: [
          "Cap table",
          "Shareholders' agreement",
          "Board minutes",
        ],
        suggested_deadlines: [],
        professional_support: [
          "Engage corporate counsel for term sheet review.",
        ],
      };
    },
  },
  {
    type: "prepare_tender",
    title: "Preparing for a tender",
    category: "Growth",
    tagline: "Check the certifications and evidence a bid will need.",
    icon_key: "award",
    questions: [
      {
        key: "buyer",
        label: "Buying organisation",
        type: "text",
        required: true,
      },
      {
        key: "public_sector",
        label: "Is it a public-sector tender?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "cyber_essentials",
        label: "Do you hold Cyber Essentials?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "iso27001",
        label: "Do you hold ISO 27001?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (!isYes("cyber_essentials"))
        actions.push({
          label: "Obtain Cyber Essentials certification",
          module: "risk",
          priority: "high",
        });
      if (isYes("public_sector") && !isYes("iso27001"))
        actions.push({
          label: "Assess ISO 27001 readiness",
          module: "risk",
          priority: "medium",
        });
      actions.push({
        label: "Prepare standard bid evidence pack",
        module: "tender-ready",
        priority: "medium",
      });
      return {
        summary: `Preparing tender for ${val("buyer")}.`,
        readiness: isYes("cyber_essentials") ? "mostly_ready" : "gaps",
        impact_level: "medium",
        affected_modules: ["tender-ready", "risk", "compliance"],
        considerations: [
          isYes("public_sector")
            ? "Public tenders typically require Cyber Essentials as a minimum."
            : "Private tenders vary - check invitation to tender.",
        ],
        risks: [],
        required_actions: actions,
        recommended_documents: ["Bid evidence pack", "Certifications"],
        suggested_deadlines: [],
        professional_support: [],
      };
    },
  },
  {
    type: "introduce_ai",
    title: "Introducing workplace AI",
    category: "Digital",
    tagline: "Cover data protection, IP and governance of new AI tools.",
    icon_key: "sparkles",
    questions: [
      {
        key: "tool",
        label: "AI tool or service",
        type: "text",
        required: true,
      },
      {
        key: "personal_data",
        label: "Will personal data be sent to the tool?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "client_data",
        label: "Will client data be sent to the tool?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "training",
        label: "Does the vendor use inputs to train models?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const actions: ScenarioResult["required_actions"] = [];
      if (isYes("personal_data"))
        actions.push({
          label: `Complete DPIA for ${val("tool")}`,
          module: "gdpr",
          priority: "high",
        });
      if (isYes("client_data"))
        actions.push({
          label: "Check customer contracts for AI restrictions",
          module: "contracts",
          priority: "high",
        });
      if (isYes("training"))
        actions.push({
          label: "Turn off model training or select enterprise plan",
          module: "risk",
          priority: "medium",
        });
      actions.push({
        label: "Publish an internal AI usage policy",
        module: "gdpr",
        priority: "medium",
      });
      return {
        summary: `Introducing ${val("tool")} into daily work.`,
        readiness:
          isYes("personal_data") || isYes("client_data")
            ? "gaps"
            : "mostly_ready",
        impact_level:
          isYes("personal_data") || isYes("client_data") ? "medium" : "low",
        affected_modules: ["gdpr", "contracts", "risk"],
        considerations: [
          "AI tools can create new data-protection, IP and confidentiality risks.",
        ],
        risks: isYes("training")
          ? ["Inputs may be used to train third-party models."]
          : [],
        required_actions: actions,
        recommended_documents: ["AI usage policy", "DPIA"],
        suggested_deadlines: [],
        professional_support: [],
      };
    },
  },
  {
    type: "new_personal_data",
    title: "Processing a new type of personal data",
    category: "Compliance",
    tagline: "Determine lawful basis and whether a DPIA is required.",
    icon_key: "database",
    questions: [
      {
        key: "purpose",
        label: "Purpose of processing",
        type: "text",
        required: true,
      },
      {
        key: "special_category",
        label: "Is it special-category data?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "children",
        label: "Does it relate to children?",
        type: "select",
        options: yn,
        required: true,
      },
      {
        key: "automated",
        label: "Will there be automated decision-making?",
        type: "select",
        options: yn,
        required: true,
      },
    ],
    generate: (a) => {
      const { isYes, val } = base(a);
      const highRisk =
        isYes("special_category") || isYes("children") || isYes("automated");
      const actions: ScenarioResult["required_actions"] = [];
      if (highRisk)
        actions.push({
          label: "Complete a DPIA before processing begins",
          module: "gdpr",
          priority: "high",
        });
      actions.push({
        label: "Update ROPA with the new processing",
        module: "gdpr",
        priority: "medium",
      });
      actions.push({
        label: "Update privacy notice",
        module: "gdpr",
        priority: "medium",
      });
      return {
        summary: `New processing: ${val("purpose")}.`,
        readiness: highRisk ? "gaps" : "mostly_ready",
        impact_level: highRisk ? "high" : "medium",
        affected_modules: ["gdpr", "compliance"],
        considerations: [
          "Identify a lawful basis before processing begins.",
          "Document the processing in your ROPA.",
        ],
        risks: highRisk
          ? ["High-risk processing under UK GDPR Article 35."]
          : [],
        required_actions: actions,
        recommended_documents: [
          "DPIA",
          "Updated privacy notice",
          "Updated ROPA",
        ],
        suggested_deadlines: [],
        professional_support: highRisk
          ? ["Speak to a data protection specialist for DPIA sign-off."]
          : [],
      };
    },
  },
];

export function scenarioByType(t: ScenarioType): ScenarioDefinition {
  const s = SCENARIOS.find((x) => x.type === t);
  if (!s) throw new Error(`Unknown scenario ${t}`);
  return s;
}

export function affectedModulesLabel(mods: ModuleKey[]) {
  return mods.join(", ");
}
