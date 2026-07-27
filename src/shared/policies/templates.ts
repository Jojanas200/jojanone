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

export type PolicyDocumentKind =
  "policy" | "notice" | "procedure" | "plan" | "handbook" | "statement";

export interface PolicyTemplate {
  key: string;
  title: string;
  category: string;
  audience: string;
  description: string;
  defaultPurpose: string;
  reviewMonths: number;
  requiresAcknowledgement: boolean;
  /** What the template produces; defaults to "policy". */
  kind?: PolicyDocumentKind;
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

// Compact constructor for the extended library (mirrors the prototype's
// extra() helper): base questions, 12-month review, no sign-off unless set.
function t(
  key: string,
  title: string,
  category: string,
  audience: string,
  description: string,
  opts: { kind?: PolicyDocumentKind; ack?: boolean; purpose?: string } = {},
): PolicyTemplate {
  return {
    key,
    title,
    category,
    audience,
    description,
    defaultPurpose:
      opts.purpose ??
      `Set out how ${title.toLowerCase()} operates in the business.`,
    reviewMonths: 12,
    requiresAcknowledgement: opts.ack ?? false,
    kind: opts.kind ?? "policy",
    guidedQuestions: withExtras(),
  };
}

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

  // --- Extended library: mirrors the prototype's full 83-template set ---
  t(
    "tpl_handbook",
    "Employee Handbook",
    "People",
    "All staff",
    "Core employment information - contracts, conduct, absence, leave and performance basics.",
    {
      kind: "handbook",
      ack: true,
      purpose:
        "Give staff a single reference for the terms, expectations and support that shape working here.",
    },
  ),
  t(
    "tpl_employee_privacy",
    "Employee Privacy Notice",
    "Data protection",
    "All staff and contractors",
    "Explains how the business processes personal data of staff and contractors.",
    { kind: "notice", ack: true },
  ),
  t(
    "tpl_contractor_privacy",
    "Contractor Privacy Notice",
    "Data protection",
    "Contractors and freelancers",
    "Explains how the business handles personal data of contractors and freelancers.",
    { kind: "notice" },
  ),
  t(
    "tpl_data_retention",
    "Data Retention and Deletion Policy",
    "Data protection",
    "All staff",
    "Retention periods for personal and business records, with secure deletion routines.",
    { ack: true },
  ),
  t(
    "tpl_sar_procedure",
    "Subject Access Request Procedure",
    "Data protection",
    "Managers and DPO",
    "Process for receiving, verifying and responding to individual rights requests within statutory deadlines.",
    { kind: "procedure" },
  ),
  t(
    "tpl_cookie_policy",
    "Cookie Policy",
    "Data protection",
    "Public (website visitors)",
    "Explains cookie use, categories, consent mechanism and how visitors can change preferences.",
    { kind: "notice" },
  ),
  t(
    "tpl_byod",
    "Bring Your Own Device Policy",
    "Security",
    "All staff and contractors",
    "Rules for using personal devices to access business systems and data.",
    { ack: true },
  ),
  t(
    "tpl_anti_harassment",
    "Anti-Harassment and Bullying Policy",
    "People",
    "All staff",
    "Commitment to a workplace free from harassment and bullying, with reporting routes.",
    { ack: true },
  ),
  t(
    "tpl_sickness_absence",
    "Sickness and Absence Policy",
    "People",
    "All staff and managers",
    "How sickness absence is reported, recorded, supported and managed.",
    { ack: true },
  ),
  t(
    "tpl_flexible_working",
    "Flexible Working Policy",
    "People",
    "All staff",
    "How flexible-working requests are made, considered and decided.",
    { ack: true },
  ),
  t(
    "tpl_holiday_leave",
    "Holiday and Leave Policy",
    "People",
    "All staff",
    "Annual leave entitlement, booking rules and carry-over.",
    { ack: true },
  ),
  t(
    "tpl_family_leave",
    "Family Leave Policy",
    "People",
    "All staff",
    "Maternity, paternity, adoption, shared parental and dependants' leave arrangements.",
    { ack: true },
  ),
  t(
    "tpl_recruitment",
    "Recruitment Policy",
    "People",
    "Managers and HR",
    "Fair and consistent process for attracting, selecting and onboarding staff.",
  ),
  t(
    "tpl_onboarding",
    "Employee Onboarding and Offboarding Procedure",
    "People",
    "Managers and HR",
    "Steps and checks that happen when a person joins or leaves the business.",
    { kind: "procedure" },
  ),
  t(
    "tpl_training_dev",
    "Training and Development Policy",
    "People",
    "All staff",
    "How training needs are identified, funded and evidenced.",
  ),
  t(
    "tpl_expenses",
    "Expenses Policy",
    "People",
    "All staff",
    "What business expenses can be claimed, how and by when.",
    { ack: true },
  ),
  t(
    "tpl_contractor_handbook",
    "Contractor Handbook",
    "People",
    "Contractors",
    "A single reference for the terms and expectations that apply to contractors.",
    { kind: "handbook", ack: true },
  ),
  t(
    "tpl_cyber_security",
    "Cyber-Security Policy",
    "Security",
    "All staff and contractors",
    "Cyber controls covering endpoints, network, cloud, backups and third parties.",
    { ack: true },
  ),
  t(
    "tpl_password_access",
    "Password and Access-Control Policy",
    "Security",
    "All staff and contractors",
    "Password strength, MFA, joiners/movers/leavers access and privileged accounts.",
    { ack: true },
  ),
  t(
    "tpl_incident_response",
    "Incident Response Plan",
    "Security",
    "IT, ops and leadership",
    "How suspected incidents are triaged, escalated, contained and reviewed.",
    { kind: "plan" },
  ),
  t(
    "tpl_disaster_recovery",
    "Disaster Recovery Plan",
    "Operations",
    "IT and ops",
    "Recovery objectives and steps for restoring systems and data after major disruption.",
    { kind: "plan" },
  ),
  t(
    "tpl_remote_security",
    "Remote Working Security Policy",
    "Security",
    "All remote staff",
    "Security expectations for staff working from home or elsewhere.",
    { ack: true },
  ),
  t(
    "tpl_records_management",
    "Records Management Policy",
    "Operations",
    "All staff",
    "How business records are created, stored, protected and disposed of.",
  ),
  t(
    "tpl_document_control",
    "Document Control Policy",
    "Operations",
    "All staff",
    "How controlled documents are drafted, approved, versioned and withdrawn.",
  ),
  t(
    "tpl_supplier_management",
    "Supplier Management Policy",
    "Operations",
    "Procurement and ops",
    "How suppliers are selected, onboarded, monitored and reviewed.",
  ),
  t(
    "tpl_procurement",
    "Procurement Policy",
    "Operations",
    "Procurement and finance",
    "How purchases are authorised, executed and evidenced.",
  ),
  t(
    "tpl_risk_management",
    "Risk Management Policy",
    "Governance",
    "Leadership and risk owners",
    "Framework for identifying, assessing, responding to and monitoring risks.",
  ),
  t(
    "tpl_conflicts",
    "Conflicts of Interest Policy",
    "Governance",
    "All staff and directors",
    "How conflicts and potential conflicts are declared and managed.",
    { ack: true },
  ),
  t(
    "tpl_delegated_authority",
    "Delegated Authority Policy",
    "Governance",
    "Directors and managers",
    "What decisions can be made at each level, with financial limits.",
  ),
  t(
    "tpl_board_decisions",
    "Board and Decision-Making Policy",
    "Governance",
    "Directors and leadership",
    "How board and leadership meetings run and how decisions are recorded.",
  ),
  t(
    "tpl_gifts",
    "Gifts and Hospitality Policy",
    "Governance",
    "All staff",
    "Limits and disclosure for accepting or offering gifts and hospitality.",
    { ack: true },
  ),
  t(
    "tpl_fraud_prevention",
    "Fraud Prevention Policy",
    "Governance",
    "All staff",
    "Preventing, detecting and responding to internal or external fraud.",
  ),
  t(
    "tpl_complaints_handling",
    "Complaints Handling Policy",
    "Customer",
    "All staff and customers",
    "Recording, investigating and resolving customer complaints.",
  ),
  t(
    "tpl_code_of_conduct",
    "Code of Conduct",
    "Governance",
    "All staff and contractors",
    "The standards of behaviour expected of everyone working for the business.",
    { ack: true },
  ),
  t(
    "tpl_lone_working",
    "Lone Working Policy",
    "Health & Safety",
    "All staff",
    "Managing the safety of people working alone or away from colleagues.",
    { ack: true },
  ),
  t(
    "tpl_homeworking_safety",
    "Homeworking Safety Policy",
    "Health & Safety",
    "All homeworkers",
    "Health and safety expectations for people working from home.",
    { ack: true },
  ),
  t(
    "tpl_accident_reporting",
    "Accident and Incident Reporting Procedure",
    "Health & Safety",
    "All staff",
    "How accidents, near-misses and RIDDOR-reportable events are recorded and reported.",
    { kind: "procedure" },
  ),
  t(
    "tpl_fire_safety",
    "Fire Safety Procedure",
    "Health & Safety",
    "All staff",
    "Fire prevention arrangements, evacuation and roles of fire wardens.",
    { kind: "procedure", ack: true },
  ),
  t(
    "tpl_dse",
    "Display Screen Equipment Policy",
    "Health & Safety",
    "All staff using screens",
    "Meeting DSE assessment and equipment obligations for screen users.",
    { ack: true },
  ),
  t(
    "tpl_wellbeing",
    "Workplace Wellbeing Policy",
    "Health & Safety",
    "All staff",
    "Supporting the mental and physical wellbeing of everyone in the business.",
  ),
  t(
    "tpl_employment_contract",
    "Employment Contract",
    "Contracts",
    "New or existing employee",
    "Written statement of the main terms of employment (Section 1 statement).",
    { ack: true },
  ),
  t(
    "tpl_offer_letter",
    "Offer Letter",
    "Contracts",
    "Candidate",
    "Formal written offer of employment, subject to the employment contract.",
    { kind: "notice" },
  ),
  t(
    "tpl_employment_confirmation_letter",
    "Employment Confirmation Letter",
    "Contracts",
    "Employee or third party",
    "Confirms current employment status, role, start date and salary (as authorised).",
    { kind: "notice" },
  ),
  t(
    "tpl_job_description",
    "Job Description",
    "People",
    "Managers and HR",
    "Role summary, responsibilities, reporting line and person specification.",
    { kind: "notice" },
  ),
  t(
    "tpl_probation_review",
    "Probation Review Record",
    "People",
    "Managers and HR",
    "Structured record of a probation review meeting and outcome.",
    { kind: "procedure" },
  ),
  t(
    "tpl_pip",
    "Performance Improvement Plan",
    "People",
    "Managers, HR and employee",
    "A structured plan to support improvement, with objectives, support and review dates.",
    { kind: "procedure" },
  ),
  t(
    "tpl_leaver_checklist",
    "Leaver Checklist",
    "People",
    "Managers and HR",
    "Checklist for offboarding - return of property, access removal, final pay and records.",
    { kind: "procedure" },
  ),
  t(
    "tpl_contractor_agreement",
    "Contractor Agreement",
    "Contracts",
    "Contractor and business",
    "Independent contractor terms - deliverables, fees, IP, confidentiality and termination.",
    { ack: true },
  ),
  t(
    "tpl_consultancy_agreement",
    "Consultancy Agreement",
    "Contracts",
    "Consultant and business",
    "Consultancy engagement terms - scope, fees, IP, confidentiality and liability.",
  ),
  t(
    "tpl_customer_services_agreement",
    "Customer Services Agreement",
    "Contracts",
    "Customer and business",
    "Terms under which services are supplied to a customer.",
  ),
  t(
    "tpl_supplier_agreement",
    "Supplier Agreement",
    "Contracts",
    "Supplier and business",
    "Terms under which goods or services are received from a supplier.",
  ),
  t(
    "tpl_nda",
    "Non-Disclosure Agreement",
    "Contracts",
    "Parties exchanging confidential information",
    "Mutual or one-way confidentiality agreement covering purpose, duration and permitted disclosures.",
  ),
  t(
    "tpl_msa",
    "Master Services Agreement",
    "Contracts",
    "Ongoing customer or supplier relationships",
    "Umbrella agreement setting standard terms; individual work covered by Statements of Work.",
  ),
  t(
    "tpl_sow",
    "Statement of Work",
    "Contracts",
    "Under an MSA",
    "Scope, deliverables, timeline and fees for a specific piece of work under an MSA.",
  ),
  t(
    "tpl_sla",
    "Service Level Agreement",
    "Contracts",
    "Customer or supplier",
    "Service levels, measurement, reporting and remedies.",
  ),
  t(
    "tpl_dpa",
    "Data Processing Agreement",
    "Contracts",
    "Processor or sub-processor",
    "Article 28 UK GDPR terms between controller and processor.",
  ),
  t(
    "tpl_contract_variation",
    "Contract Variation Letter",
    "Contracts",
    "Existing counterparty",
    "Letter varying agreed terms of an existing contract.",
    { kind: "notice" },
  ),
  t(
    "tpl_renewal_letter",
    "Renewal Letter",
    "Contracts",
    "Existing counterparty",
    "Letter proposing or confirming renewal of an existing contract.",
    { kind: "notice" },
  ),
  t(
    "tpl_termination_notice",
    "Termination Notice",
    "Contracts",
    "Existing counterparty",
    "Notice terminating a contract in line with its termination provisions.",
    { kind: "notice" },
  ),
  t(
    "tpl_heads_of_terms",
    "Heads of Terms",
    "Contracts",
    "Prospective counterparty",
    "Non-binding summary of principal commercial terms ahead of a full agreement.",
    { kind: "statement" },
  ),
  t(
    "tpl_mou",
    "Memorandum of Understanding",
    "Contracts",
    "Partner organisation",
    "Statement of intent between parties, generally non-binding.",
    { kind: "statement" },
  ),
  t(
    "tpl_board_minutes",
    "Board Minutes",
    "Governance",
    "Directors and company secretary",
    "Minutes of a board meeting - attendance, decisions, actions and next meeting.",
    { kind: "statement" },
  ),
  t(
    "tpl_written_resolution",
    "Written Resolution",
    "Governance",
    "Directors or members",
    "Formal written resolution passed without a meeting.",
    { kind: "statement" },
  ),
  t(
    "tpl_hs_procedure",
    "Health and Safety Procedure",
    "Health & Safety",
    "All staff",
    "A specific health and safety procedure covering a task, activity or hazard.",
    { kind: "procedure" },
  ),
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
