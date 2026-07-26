import { z } from "zod";

// Decision scenarios ("what do I need to think about if I…"). Each scenario type
// has a concise playbook of considerations; a run records which are handled.

export const scenarioTypeEnum = z.enum([
  "hire_employee",
  "engage_contractor",
  "new_customer",
  "new_supplier",
  "launch_website",
  "expand_market",
  "raise_investment",
  "prepare_tender",
  "introduce_ai",
  "new_personal_data",
]);
export type ScenarioType = z.infer<typeof scenarioTypeEnum>;

export const SCENARIO_PLAYBOOKS: Record<
  ScenarioType,
  { label: string; considerations: { key: string; label: string }[] }
> = {
  hire_employee: {
    label: "Hire an employee",
    considerations: [
      { key: "rtw", label: "Right-to-work check completed" },
      { key: "contract", label: "Written statement / contract issued" },
      { key: "payroll", label: "Payroll and PAYE set up" },
      { key: "pension", label: "Auto-enrolment pension assessed" },
      { key: "insurance", label: "Employers' liability insurance in place" },
      { key: "policies", label: "Key policies shared (handbook, H&S)" },
    ],
  },
  engage_contractor: {
    label: "Engage a contractor",
    considerations: [
      { key: "status", label: "Employment status / IR35 assessed" },
      { key: "contract", label: "Contractor agreement signed" },
      { key: "insurance", label: "Contractor insurance verified" },
      { key: "ip", label: "IP ownership addressed" },
    ],
  },
  new_customer: {
    label: "Take on a new customer",
    considerations: [
      { key: "terms", label: "Contract / terms of business agreed" },
      { key: "credit", label: "Credit check / payment terms set" },
      { key: "dpa", label: "Data sharing / DPA considered" },
      { key: "onboarding", label: "Onboarding and delivery plan agreed" },
    ],
  },
  new_supplier: {
    label: "Onboard a new supplier",
    considerations: [
      { key: "contract", label: "Supplier contract in place" },
      { key: "dd", label: "Due diligence completed" },
      { key: "dpa", label: "Data processing agreement (if data shared)" },
      { key: "dependency", label: "Single-supplier dependency assessed" },
    ],
  },
  launch_website: {
    label: "Launch a website",
    considerations: [
      { key: "privacy", label: "Privacy notice published" },
      { key: "cookies", label: "Cookie consent implemented" },
      { key: "terms", label: "Website terms of use published" },
      { key: "accessibility", label: "Accessibility considered" },
    ],
  },
  expand_market: {
    label: "Expand into a new market",
    considerations: [
      { key: "regulatory", label: "Local regulatory requirements checked" },
      { key: "tax", label: "Tax / VAT implications assessed" },
      { key: "contracts", label: "Contracts adapted for the market" },
      { key: "data", label: "Cross-border data transfers assessed" },
    ],
  },
  raise_investment: {
    label: "Raise investment",
    considerations: [
      { key: "captable", label: "Cap table is clean and current" },
      { key: "dataroom", label: "Data room assembled" },
      { key: "accounts", label: "Accounts and forecast ready" },
      { key: "legal", label: "Key contracts and IP documented" },
    ],
  },
  prepare_tender: {
    label: "Prepare a tender bid",
    considerations: [
      { key: "eligibility", label: "Eligibility criteria met" },
      { key: "accreditations", label: "Required accreditations held" },
      { key: "capacity", label: "Delivery capacity confirmed" },
      { key: "evidence", label: "Evidence and case studies ready" },
    ],
  },
  introduce_ai: {
    label: "Introduce AI into the business",
    considerations: [
      { key: "data", label: "Personal data use assessed (DPIA if needed)" },
      { key: "accuracy", label: "Output accuracy and oversight in place" },
      { key: "policy", label: "Acceptable-use / AI policy set" },
      { key: "vendor", label: "Vendor terms and data handling reviewed" },
    ],
  },
  new_personal_data: {
    label: "Start processing new personal data",
    considerations: [
      { key: "lawful_basis", label: "Lawful basis identified" },
      { key: "ropa", label: "Added to the ROPA" },
      { key: "privacy", label: "Privacy notice updated" },
      { key: "security", label: "Security measures in place" },
      { key: "dpia", label: "DPIA completed if high risk" },
    ],
  },
};

// Typed questionnaire answers: booleans for checks, text/select strings,
// numbers for values, ISO dates as strings.
export const createScenarioRunSchema = z.object({
  scenarioType: scenarioTypeEnum,
  scenarioName: z.string().trim().min(1).max(200),
  answers: z
    .record(
      z.string(),
      z.union([z.string().max(2000), z.number(), z.boolean()]),
    )
    .default({}),
});
export type CreateScenarioRunInput = z.infer<typeof createScenarioRunSchema>;
