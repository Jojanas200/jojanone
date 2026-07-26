// Policy templates + guided-question sets for the "Draft with Jova" flow.
// Ported and adapted from the prototype: each template carries a suggested
// purpose, a section skeleton, and guided questions whose answers feed named
// sections of the drafted document. Kept framework-free so it is shared by the
// server (composition) and the client (the guided wizard).

export type AnswerType = "short" | "long";

export interface PolicyGuidedQuestion {
  key: string;
  question: string;
  hint?: string;
  optional?: boolean;
  /** Section key the answer feeds into. */
  sectionTarget: string;
  answerType: AnswerType;
}

export interface PolicySection {
  key: string;
  heading: string;
  optional?: boolean;
}

export interface PolicyTemplate {
  key: string;
  title: string;
  category: string;
  audience: string;
  description: string;
  defaultPurpose: string;
  reviewMonths: number;
  requiresAcknowledgement: boolean;
  guidedQuestions: PolicyGuidedQuestion[];
}

// Content section skeleton (document control / approval / version history are
// handled by the app's version history + sign-off, so the body focuses on the
// substantive sections).
export const POLICY_SECTIONS: PolicySection[] = [
  { key: "purpose", heading: "Purpose" },
  { key: "scope", heading: "Scope" },
  { key: "definitions", heading: "Definitions", optional: true },
  { key: "roles", heading: "Roles and responsibilities" },
  { key: "policy_statements", heading: "Policy statements" },
  { key: "procedures", heading: "Procedures" },
  { key: "reporting", heading: "Reporting and escalation" },
  { key: "records", heading: "Record keeping" },
  { key: "training", heading: "Training and awareness", optional: true },
  { key: "monitoring", heading: "Monitoring", optional: true },
  {
    key: "professional_support",
    heading: "Professional-support considerations",
  },
  { key: "review_schedule", heading: "Review schedule" },
];

// The nine questions asked for every policy. The first is the Purpose.
export const BASE_QUESTIONS: PolicyGuidedQuestion[] = [
  {
    key: "purpose",
    question: "What is the purpose of this policy?",
    hint: "A sentence or two on what the policy is for and why it matters.",
    sectionTarget: "purpose",
    answerType: "long",
  },
  {
    key: "scope",
    question: "Who and what is covered by this policy?",
    sectionTarget: "scope",
    answerType: "long",
  },
  {
    key: "responsibilities",
    question: "Who is responsible for making this policy work day to day?",
    sectionTarget: "roles",
    answerType: "long",
  },
  {
    key: "procedures",
    question:
      "Describe the current procedure being followed (or the one you want to introduce).",
    sectionTarget: "procedures",
    answerType: "long",
  },
  {
    key: "reporting",
    question:
      "How should people raise questions, concerns or breaches of this policy?",
    sectionTarget: "reporting",
    answerType: "short",
  },
  {
    key: "training",
    question: "What training or awareness is required, if any?",
    optional: true,
    sectionTarget: "training",
    answerType: "short",
  },
  {
    key: "records",
    question: "What records and evidence must be kept?",
    sectionTarget: "records",
    answerType: "short",
  },
  {
    key: "review",
    question: "How often should this policy be reviewed?",
    hint: "Most policies review annually - more often when the risk is high.",
    sectionTarget: "review_schedule",
    answerType: "short",
  },
  {
    key: "professional_support",
    question: "What professional support has already been received, if any?",
    optional: true,
    sectionTarget: "professional_support",
    answerType: "short",
  },
];

const withExtras = (extras: PolicyGuidedQuestion[] = []) => [
  ...BASE_QUESTIONS,
  ...extras,
];

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    key: "tpl_data_protection",
    title: "Data Protection Policy",
    category: "Data protection",
    audience: "All staff and contractors",
    description:
      "How you collect, use and protect personal data under UK GDPR.",
    defaultPurpose:
      "Explain how the organisation collects, uses and protects personal data.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras([
      {
        key: "lawful_bases",
        question:
          "Which lawful bases do you rely on most (contract, legitimate interests, consent, legal obligation)?",
        sectionTarget: "policy_statements",
        answerType: "short",
      },
      {
        key: "rights_route",
        question:
          "How do individuals exercise their data rights (contact, timeframe)?",
        sectionTarget: "reporting",
        answerType: "short",
      },
    ]),
  },
  {
    key: "tpl_privacy_notice",
    title: "Privacy Policy",
    category: "Data protection",
    audience: "Public (customers and website visitors)",
    description: "Tell customers and visitors what data you collect and why.",
    defaultPurpose:
      "Tell customers and website visitors what personal data you collect and how you use it.",
    reviewMonths: 12,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_info_security",
    title: "Information Security Policy",
    category: "Security",
    audience: "All staff and contractors",
    description: "Consistent controls that protect systems, data and users.",
    defaultPurpose:
      "Protect systems, information and users through consistent security controls.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_breach_response",
    title: "Data Breach Response Policy",
    category: "Data protection",
    audience: "All staff",
    description:
      "Identify, contain and report suspected personal-data breaches.",
    defaultPurpose:
      "Ensure suspected personal-data breaches are identified, contained and reported promptly.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_acceptable_use",
    title: "Acceptable Use Policy",
    category: "Security",
    audience: "All staff and contractors",
    description: "How company systems and information may and may not be used.",
    defaultPurpose:
      "Set clear expectations for how company systems and information may be used.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_ai_use",
    title: "AI Use Policy",
    category: "Technology",
    audience: "All staff",
    description: "Use AI tools responsibly without exposing sensitive data.",
    defaultPurpose:
      "Ensure AI tools are used responsibly, transparently and without exposing sensitive data.",
    reviewMonths: 6,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras([
      {
        key: "approved_tools",
        question: "Which AI tools are approved for business use?",
        sectionTarget: "policy_statements",
        answerType: "short",
      },
      {
        key: "prohibited",
        question: "What data must never be entered into third-party AI tools?",
        sectionTarget: "policy_statements",
        answerType: "short",
      },
    ]),
  },
  {
    key: "tpl_remote_working",
    title: "Remote Working Policy",
    category: "People",
    audience: "All staff",
    description:
      "How remote working operates so staff and the business are supported.",
    defaultPurpose:
      "Set out how remote working operates so staff and the business are supported.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_equal_opps",
    title: "Equal Opportunities Policy",
    category: "People",
    audience: "All staff",
    description: "Your commitment to fair treatment and equal opportunities.",
    defaultPurpose:
      "Show the organisation's commitment to fair treatment and equal opportunities for all.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_disciplinary",
    title: "Disciplinary Policy",
    category: "People",
    audience: "Managers and all staff",
    description: "A fair, consistent process for disciplinary matters.",
    defaultPurpose:
      "Ensure a fair, consistent process is followed for disciplinary matters.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_grievance",
    title: "Grievance Policy",
    category: "People",
    audience: "All staff",
    description:
      "A clear route to raise workplace concerns and how you respond.",
    defaultPurpose:
      "Provide a clear route to raise workplace concerns and how the business responds.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_rtw",
    title: "Right-to-Work Procedure",
    category: "People",
    audience: "Managers and HR",
    description: "Ensure everyone employed has the legal right to work here.",
    defaultPurpose:
      "Ensure that everyone employed by the business has the legal right to work here.",
    reviewMonths: 12,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_health_safety",
    title: "Health and Safety Policy",
    category: "Health & Safety",
    audience: "All staff",
    description:
      "Manage health and safety risks proportionate to your activities.",
    defaultPurpose:
      "Set out how the business manages health and safety risks proportionate to its activities.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras([
      {
        key: "riddor",
        question:
          "How will RIDDOR-reportable incidents be identified and reported?",
        sectionTarget: "reporting",
        answerType: "short",
      },
    ]),
  },
  {
    key: "tpl_bcp",
    title: "Business Continuity Policy",
    category: "Operations",
    audience: "All staff",
    description: "Keep critical activities running when disruption occurs.",
    defaultPurpose:
      "Ensure the business can continue critical activities when disruption occurs.",
    reviewMonths: 12,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_complaints",
    title: "Complaints Policy",
    category: "Customer",
    audience: "All staff and customers",
    description: "Handle complaints fairly and use them to improve.",
    defaultPurpose:
      "Ensure customer complaints are handled fairly, promptly and used to improve the business.",
    reviewMonths: 24,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_anti_bribery",
    title: "Anti-Bribery Policy",
    category: "Governance",
    audience: "All staff and contractors",
    description: "Prevent bribery and corruption across the business.",
    defaultPurpose:
      "Prevent bribery and corruption in all business activities.",
    reviewMonths: 24,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_supplier_dd",
    title: "Supplier Due-Diligence Policy",
    category: "Operations",
    audience: "Procurement and finance",
    description: "Assess suppliers proportionately for trust and suitability.",
    defaultPurpose:
      "Ensure suppliers are appropriate, trustworthy and proportionately assessed.",
    reviewMonths: 12,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_records_retention",
    title: "Records Retention Policy",
    category: "Data protection",
    audience: "All staff",
    description: "Keep records only as long as necessary and dispose securely.",
    defaultPurpose:
      "Ensure records are kept only as long as necessary and disposed of securely.",
    reviewMonths: 12,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_whistleblowing",
    title: "Whistleblowing Policy",
    category: "Governance",
    audience: "All staff",
    description:
      "A safe route to raise serious concerns in the public interest.",
    defaultPurpose:
      "Give staff a safe, confidential route to raise serious concerns without fear of reprisal.",
    reviewMonths: 12,
    requiresAcknowledgement: true,
    guidedQuestions: withExtras(),
  },
  {
    key: "tpl_modern_slavery",
    title: "Modern Slavery Statement",
    category: "Governance",
    audience: "All staff and suppliers",
    description:
      "Your stance and steps against modern slavery in operations and supply chains.",
    defaultPurpose:
      "Set out the steps taken to ensure modern slavery is not present in the business or its supply chains.",
    reviewMonths: 12,
    requiresAcknowledgement: false,
    guidedQuestions: withExtras(),
  },
];

export function getPolicyTemplate(key: string | null | undefined) {
  return key ? (POLICY_TEMPLATES.find((t) => t.key === key) ?? null) : null;
}

/** Questions for the guided wizard: the template's, or the base set for a blank. */
export function questionsFor(key: string | null | undefined) {
  return getPolicyTemplate(key)?.guidedQuestions ?? BASE_QUESTIONS;
}

export const sectionHeading = (key: string) =>
  POLICY_SECTIONS.find((s) => s.key === key)?.heading ?? key;
