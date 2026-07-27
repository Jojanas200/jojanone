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
  | "policy"
  | "notice"
  | "procedure"
  | "plan"
  | "handbook"
  | "statement"
  | "contract";

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

export const sectionHeading = (key: string) =>
  POLICY_SECTIONS.find((s) => s.key === key)?.heading ?? key;

// ---------------------------------------------------------------------------
// Document-aware guided drafting.
//
// Category -> template -> question set -> Jova draft. Policies keep the
// original questionnaire (BASE_QUESTIONS + per-template extras). Every other
// document kind gets its own section skeleton and question set, with
// template-specific sets for contracts, letters, procedures, plans, records
// and handbooks - so Jova asks about the document actually being drafted.
// ---------------------------------------------------------------------------

// Kind refinements kept out of the literal library entries above so the data
// stays compact: agreements are contracts, not policies; two originals are a
// statement and a procedure respectively.
const KIND_OVERRIDES: Record<string, PolicyDocumentKind> = {
  tpl_employment_contract: "contract",
  tpl_contractor_agreement: "contract",
  tpl_consultancy_agreement: "contract",
  tpl_customer_services_agreement: "contract",
  tpl_supplier_agreement: "contract",
  tpl_nda: "contract",
  tpl_msa: "contract",
  tpl_sow: "contract",
  tpl_sla: "contract",
  tpl_dpa: "contract",
  tpl_modern_slavery: "statement",
  tpl_rtw: "procedure",
};
for (const t of POLICY_TEMPLATES) {
  const k = KIND_OVERRIDES[t.key];
  if (k) t.kind = k;
}

export const kindOf = (key: string | null | undefined): PolicyDocumentKind =>
  getPolicyTemplate(key)?.kind ?? "policy";

// --- Section skeletons per document kind -----------------------------------

export const CONTRACT_SECTIONS: PolicySection[] = [
  { key: "parties", heading: "Parties" },
  { key: "background", heading: "Background", optional: true },
  { key: "services", heading: "Services and scope" },
  { key: "deliverables", heading: "Deliverables", optional: true },
  { key: "fees", heading: "Fees and payment" },
  { key: "term", heading: "Term and dates" },
  {
    key: "obligations",
    heading: "Obligations and responsibilities",
    optional: true,
  },
  { key: "confidentiality", heading: "Confidentiality", optional: true },
  { key: "ip", heading: "Intellectual property", optional: true },
  { key: "data_protection", heading: "Data protection", optional: true },
  { key: "liability", heading: "Liability", optional: true },
  { key: "termination", heading: "Termination" },
  { key: "general", heading: "Notices and general", optional: true },
  { key: "signatures", heading: "Signatures" },
];

export const PROCEDURE_SECTIONS: PolicySection[] = [
  { key: "purpose", heading: "Purpose" },
  { key: "trigger", heading: "When this procedure applies" },
  { key: "roles", heading: "Roles and responsibilities" },
  { key: "steps", heading: "Procedure steps" },
  { key: "escalation", heading: "Escalation", optional: true },
  { key: "records", heading: "Records" },
  { key: "review_schedule", heading: "Review schedule" },
];

export const PLAN_SECTIONS: PolicySection[] = [
  { key: "purpose", heading: "Purpose and scope" },
  { key: "scenarios", heading: "Scenarios covered" },
  { key: "activation", heading: "Activation triggers" },
  { key: "roles", heading: "Roles and responsibilities" },
  { key: "response", heading: "Response steps" },
  { key: "recovery", heading: "Recovery steps", optional: true },
  { key: "communications", heading: "Communications", optional: true },
  { key: "testing", heading: "Testing and review" },
];

export const HANDBOOK_SECTIONS: PolicySection[] = [
  { key: "welcome", heading: "Welcome and purpose" },
  { key: "working", heading: "Working arrangements" },
  { key: "conduct", heading: "Conduct and standards" },
  { key: "leave", heading: "Leave and absence", optional: true },
  { key: "support", heading: "Support and contacts", optional: true },
  { key: "related", heading: "Key policies referenced", optional: true },
  { key: "acknowledgement", heading: "Acknowledgement" },
];

export const NOTICE_SECTIONS: PolicySection[] = [
  { key: "purpose", heading: "Purpose" },
  { key: "recipient", heading: "Recipient", optional: true },
  { key: "background", heading: "Background", optional: true },
  { key: "details", heading: "Details" },
  { key: "next_steps", heading: "Next steps", optional: true },
  { key: "contact", heading: "Contact" },
];

export const STATEMENT_SECTIONS: PolicySection[] = [
  { key: "background", heading: "Background" },
  { key: "details", heading: "Substance" },
  { key: "decisions", heading: "Decisions and actions", optional: true },
  { key: "approval", heading: "Approval and sign-off" },
];

const SECTIONS_BY_KIND: Record<PolicyDocumentKind, PolicySection[]> = {
  policy: POLICY_SECTIONS,
  contract: CONTRACT_SECTIONS,
  procedure: PROCEDURE_SECTIONS,
  plan: PLAN_SECTIONS,
  handbook: HANDBOOK_SECTIONS,
  notice: NOTICE_SECTIONS,
  statement: STATEMENT_SECTIONS,
};

/** Section skeleton for a template (policy skeleton for blanks). */
export function sectionsFor(key: string | null | undefined): PolicySection[] {
  return SECTIONS_BY_KIND[kindOf(key)];
}

// --- Question sets ----------------------------------------------------------

const q = (
  key: string,
  question: string,
  sectionTarget: string,
  answerType: AnswerType = "long",
  optional = false,
  hint?: string,
): PolicyGuidedQuestion => ({
  key,
  question,
  sectionTarget,
  answerType,
  ...(optional ? { optional: true } : {}),
  ...(hint ? { hint } : {}),
});

// Kind-level fallbacks for any non-policy template without its own set.
const CONTRACT_QUESTIONS: PolicyGuidedQuestion[] = [
  q(
    "counterparty",
    "Who is the other party (name and role)?",
    "parties",
    "short",
  ),
  q(
    "services",
    "What is being provided or done under this agreement?",
    "services",
  ),
  q("fees", "What are the fees and payment terms?", "fees", "short"),
  q("term", "When does it start, and how long does it run?", "term", "short"),
  q(
    "obligations",
    "Any specific obligations or service standards?",
    "obligations",
    "long",
    true,
  ),
  q(
    "confidentiality",
    "Any confidentiality or IP terms to capture?",
    "confidentiality",
    "long",
    true,
  ),
  q(
    "termination",
    "How can it be ended (notice, grounds)?",
    "termination",
    "short",
  ),
];

const PROCEDURE_QUESTIONS: PolicyGuidedQuestion[] = [
  q("trigger", "When does this procedure apply - what triggers it?", "trigger"),
  q("responsible", "Who is responsible for carrying it out?", "roles", "short"),
  q("steps", "Describe the steps, in order.", "steps"),
  q(
    "escalation",
    "When and to whom should things be escalated?",
    "escalation",
    "short",
    true,
  ),
  q("records", "What must be recorded, and where?", "records", "short"),
  q(
    "review",
    "How often should this procedure be reviewed?",
    "review_schedule",
    "short",
    true,
  ),
];

const PLAN_QUESTIONS: PolicyGuidedQuestion[] = [
  q("scenarios", "What risks or scenarios does this plan cover?", "scenarios"),
  q(
    "activation",
    "What triggers activation, and who decides?",
    "activation",
    "short",
  ),
  q("responsible", "Who does what when the plan is activated?", "roles"),
  q("response", "What are the immediate response steps?", "response"),
  q(
    "recovery",
    "How do you recover back to normal operations?",
    "recovery",
    "long",
    true,
  ),
  q(
    "communications",
    "Who must be informed, and how?",
    "communications",
    "short",
    true,
  ),
  q(
    "testing",
    "How and how often will the plan be tested?",
    "testing",
    "short",
    true,
  ),
];

const HANDBOOK_QUESTIONS: PolicyGuidedQuestion[] = [
  q(
    "working",
    "Describe your working arrangements (hours, location, flexibility).",
    "working",
  ),
  q("conduct", "What conduct and standards do you expect?", "conduct"),
  q(
    "leave",
    "How do holidays, sickness and other leave work?",
    "leave",
    "long",
    true,
  ),
  q(
    "support",
    "Who do people go to for help, pay queries or concerns?",
    "support",
    "short",
    true,
  ),
  q(
    "related",
    "Which policies should it point people to?",
    "related",
    "short",
    true,
  ),
];

const LETTER_QUESTIONS: PolicyGuidedQuestion[] = [
  q("recipient", "Who is this for?", "recipient", "short"),
  q("details", "What are the key details to include?", "details"),
  q(
    "next_steps",
    "What should happen next (dates, actions, acceptance)?",
    "next_steps",
    "short",
    true,
  ),
];

const STATEMENT_QUESTIONS: PolicyGuidedQuestion[] = [
  q(
    "background",
    "What is this record about (context, parties, date)?",
    "background",
  ),
  q("details", "Set out the substance - the key points or terms.", "details"),
  q(
    "approval",
    "Who approves or signs this, and when?",
    "approval",
    "short",
    true,
  ),
];

const KIND_QUESTIONS: Partial<
  Record<PolicyDocumentKind, PolicyGuidedQuestion[]>
> = {
  contract: CONTRACT_QUESTIONS,
  procedure: PROCEDURE_QUESTIONS,
  plan: PLAN_QUESTIONS,
  handbook: HANDBOOK_QUESTIONS,
  notice: LETTER_QUESTIONS,
  statement: STATEMENT_QUESTIONS,
};

// Template-specific sets. Company identity is never asked - Jova already
// knows the business from the profile.
const TEMPLATE_QUESTIONS: Record<string, PolicyGuidedQuestion[]> = {
  // ---- Contracts: employment ----
  tpl_employment_contract: [
    q("employee", "Employee's full name?", "parties", "short"),
    q("job_title", "Job title and main duties?", "services"),
    q(
      "start_date",
      "Start date (and any continuous-service date)?",
      "term",
      "short",
    ),
    q("salary", "Salary and how it is paid?", "fees", "short"),
    q(
      "hours_place",
      "Hours of work and place of work?",
      "obligations",
      "short",
    ),
    q("probation", "Probation period, if any?", "term", "short", true),
    q(
      "holiday_benefits",
      "Holiday entitlement and any benefits?",
      "obligations",
      "short",
      true,
    ),
    q("notice", "Notice period each side must give?", "termination", "short"),
  ],
  tpl_offer_letter: [
    q("candidate", "Candidate's name?", "recipient", "short"),
    q("role", "Role being offered?", "details", "short"),
    q("salary", "Salary and key terms of the offer?", "details", "short"),
    q("start_date", "Proposed start date?", "details", "short"),
    q(
      "conditions",
      "Conditions of the offer (references, right to work, checks)?",
      "next_steps",
      "long",
      true,
    ),
  ],
  tpl_employment_confirmation_letter: [
    q("employee", "Employee's name and job title?", "details", "short"),
    q(
      "dates_status",
      "Employment start date and current status?",
      "details",
      "short",
    ),
    q("salary", "Include salary? If so, state it.", "details", "short", true),
    q(
      "recipient_purpose",
      "Who is the letter for, and what is it needed for?",
      "purpose",
      "short",
    ),
  ],
  // ---- Contracts: commercial ----
  tpl_contractor_agreement: [
    q("contractor", "Contractor's name or company?", "parties", "short"),
    q("services", "What services will they provide?", "services"),
    q(
      "deliverables",
      "Specific deliverables, if any?",
      "deliverables",
      "long",
      true,
    ),
    q(
      "fees",
      "Fees and payment terms (rate, invoicing, expenses)?",
      "fees",
      "short",
    ),
    q("ip", "Who owns the work produced (IP)?", "ip", "short", true),
    q(
      "confidentiality",
      "Confidentiality expectations?",
      "confidentiality",
      "short",
      true,
    ),
    q("term", "Duration of the engagement?", "term", "short"),
    q("termination", "How can either side end it?", "termination", "short"),
  ],
  tpl_consultancy_agreement: [
    q("consultant", "Consultant's name or company?", "parties", "short"),
    q("scope", "Scope of the consultancy?", "services"),
    q("deliverables", "Deliverables expected?", "deliverables", "long", true),
    q("fees", "Fees and payment terms?", "fees", "short"),
    q("ip", "Who owns the outputs (IP)?", "ip", "short", true),
    q(
      "liability",
      "Any liability caps or exclusions to record?",
      "liability",
      "short",
      true,
    ),
    q("term", "Duration, and how it ends?", "term", "short"),
  ],
  tpl_customer_services_agreement: [
    q("customer", "Customer's name or company?", "parties", "short"),
    q("services", "What services are you supplying?", "services"),
    q("fees", "Fees and payment terms?", "fees", "short"),
    q(
      "responsibilities",
      "What must each side do (responsibilities)?",
      "obligations",
      "long",
      true,
    ),
    q("term", "Service period (start, length, renewal)?", "term", "short"),
    q("ip", "IP position on anything created?", "ip", "short", true),
    q(
      "liability",
      "Liability position (caps, exclusions)?",
      "liability",
      "short",
      true,
    ),
    q("termination", "Termination rights?", "termination", "short"),
  ],
  tpl_supplier_agreement: [
    q("supplier", "Supplier's name or company?", "parties", "short"),
    q(
      "goods_services",
      "What goods or services are they supplying?",
      "services",
    ),
    q("pricing", "Pricing and payment terms?", "fees", "short"),
    q(
      "delivery",
      "Delivery or service requirements and standards?",
      "obligations",
      "long",
      true,
    ),
    q("liability", "Liability position?", "liability", "short", true),
    q("termination", "Termination rights?", "termination", "short"),
  ],
  tpl_nda: [
    q("other_party", "Who is the other party?", "parties", "short"),
    q(
      "direction",
      "Mutual, or one-way? Who is disclosing?",
      "background",
      "short",
    ),
    q(
      "purpose",
      "What is the information being shared for?",
      "services",
      "short",
    ),
    q(
      "confidential_info",
      "What counts as confidential information here?",
      "confidentiality",
    ),
    q(
      "permitted",
      "Any permitted disclosures (advisers, staff, regulators)?",
      "confidentiality",
      "short",
      true,
    ),
    q("period", "How long must confidentiality last?", "term", "short"),
  ],
  tpl_msa: [
    q("counterparty", "Who is the other party?", "parties", "short"),
    q(
      "relationship",
      "Describe the overall relationship this umbrella covers.",
      "background",
    ),
    q(
      "services",
      "What kinds of services will be provided under it?",
      "services",
    ),
    q(
      "payment",
      "Payment structure (rates, invoicing, terms)?",
      "fees",
      "short",
    ),
    q(
      "sows",
      "How will individual Statements of Work be agreed?",
      "deliverables",
      "short",
      true,
    ),
    q("ip", "IP position?", "ip", "short", true),
    q("liability", "Liability position?", "liability", "short", true),
    q("termination", "Termination rights?", "termination", "short"),
  ],
  tpl_sow: [
    q(
      "msa",
      "Which Master Services Agreement does this sit under?",
      "background",
      "short",
    ),
    q("project", "Project and scope of this piece of work?", "services"),
    q("deliverables", "Deliverables?", "deliverables"),
    q("milestones", "Milestones and key dates?", "term", "short"),
    q(
      "responsibilities",
      "Who is responsible for what?",
      "obligations",
      "short",
      true,
    ),
    q("fees", "Fees for this work?", "fees", "short"),
    q(
      "acceptance",
      "Acceptance criteria - when is it done?",
      "deliverables",
      "short",
      true,
    ),
  ],
  tpl_sla: [
    q("service", "Which service does this SLA cover?", "services", "short"),
    q("levels", "Service levels / KPIs (targets)?", "obligations"),
    q(
      "measurement",
      "How are they measured and reported?",
      "obligations",
      "short",
    ),
    q(
      "availability",
      "Availability and response/fix times?",
      "obligations",
      "short",
      true,
    ),
    q(
      "escalation",
      "Escalation route when levels are missed?",
      "general",
      "short",
      true,
    ),
    q(
      "remedies",
      "Remedies (service credits, termination rights)?",
      "liability",
      "short",
      true,
    ),
  ],
  tpl_dpa: [
    q(
      "processor",
      "Who is the processor (and who is controller)?",
      "parties",
      "short",
    ),
    q(
      "purpose_duration",
      "Purpose and duration of the processing?",
      "background",
      "short",
    ),
    q(
      "data_types",
      "Types of personal data and categories of data subjects?",
      "data_protection",
    ),
    q(
      "security",
      "Security measures required?",
      "data_protection",
      "long",
      true,
    ),
    q(
      "subprocessors",
      "Are sub-processors allowed, and on what terms?",
      "data_protection",
      "short",
      true,
    ),
    q(
      "transfers",
      "Any international transfers, and safeguards?",
      "data_protection",
      "short",
      true,
    ),
    q(
      "deletion",
      "What happens to data at the end (deletion/return)?",
      "termination",
      "short",
    ),
  ],
  // ---- Contracts: letters ----
  tpl_contract_variation: [
    q(
      "existing",
      "Which existing contract is being varied (name, date)?",
      "background",
      "short",
    ),
    q("parties", "Who are the parties?", "recipient", "short"),
    q(
      "changes",
      "Which clauses or terms are changing, and to what?",
      "details",
    ),
    q("effective", "Effective date of the variation?", "details", "short"),
    q(
      "acceptance",
      "How will the other party accept (signature, email)?",
      "next_steps",
      "short",
      true,
    ),
  ],
  tpl_renewal_letter: [
    q("existing", "Which agreement is being renewed?", "background", "short"),
    q("period", "Renewal period and new dates?", "details", "short"),
    q("changes", "Any changes to terms or pricing?", "details", "long", true),
    q(
      "acceptance",
      "How should they confirm acceptance?",
      "next_steps",
      "short",
      true,
    ),
  ],
  tpl_termination_notice: [
    q(
      "existing",
      "Which agreement is being terminated?",
      "background",
      "short",
    ),
    q(
      "clause",
      "Which termination clause are you relying on?",
      "details",
      "short",
    ),
    q(
      "reason",
      "Reason for termination (where appropriate)?",
      "details",
      "long",
      true,
    ),
    q(
      "notice",
      "Notice period being given and termination date?",
      "details",
      "short",
    ),
    q(
      "next_steps",
      "What must happen next (handover, final payment, returns)?",
      "next_steps",
      "long",
      true,
    ),
  ],
  tpl_heads_of_terms: [
    q("parties", "Who are the parties?", "background", "short"),
    q(
      "transaction",
      "What transaction or relationship is proposed?",
      "details",
    ),
    q("commercial", "Principal commercial terms?", "details"),
    q("price", "Price or fees proposed?", "details", "short", true),
    q(
      "conditions",
      "Key conditions before it becomes binding?",
      "details",
      "short",
      true,
    ),
    q(
      "exclusivity",
      "Any exclusivity or confidentiality terms?",
      "details",
      "short",
      true,
    ),
    q("timetable", "Intended timetable?", "details", "short", true),
  ],
  tpl_mou: [
    q("parties", "Who are the parties?", "background", "short"),
    q("purpose", "Purpose of the understanding?", "details"),
    q("collaboration", "What collaboration is proposed?", "details"),
    q(
      "responsibilities",
      "Each party's responsibilities?",
      "details",
      "long",
      true,
    ),
    q("duration", "Duration of the arrangement?", "details", "short", true),
    q(
      "binding",
      "Which provisions (if any) are intended to be binding?",
      "approval",
      "short",
    ),
  ],
  // ---- Data protection documents ----
  tpl_employee_privacy: [
    q("data", "What personal data do you hold about staff?", "details"),
    q("purposes", "What do you use it for?", "details"),
    q(
      "lawful",
      "Lawful bases you rely on (if known)?",
      "details",
      "short",
      true,
    ),
    q(
      "sharing",
      "Who is it shared with (payroll, pension, HMRC)?",
      "details",
      "short",
      true,
    ),
    q("retention", "How long is it kept?", "details", "short", true),
    q("contact", "Who do staff contact about their data?", "contact", "short"),
  ],
  tpl_contractor_privacy: [
    q("data", "What personal data do you hold about contractors?", "details"),
    q("purposes", "What do you use it for?", "details"),
    q("sharing", "Who is it shared with?", "details", "short", true),
    q("retention", "How long is it kept?", "details", "short", true),
    q(
      "contact",
      "Who do contractors contact about their data?",
      "contact",
      "short",
    ),
  ],
  tpl_sar_procedure: [
    q(
      "channels",
      "How can requests arrive (email, post, verbally)?",
      "trigger",
      "short",
    ),
    q("responsible", "Who owns and responds to requests?", "roles", "short"),
    q(
      "verification",
      "How do you verify the requester's identity?",
      "steps",
      "short",
    ),
    q("steps", "Steps to gather, review and respond?", "steps"),
    q(
      "deadline",
      "Response deadline and extension approach?",
      "steps",
      "short",
      true,
    ),
    q(
      "records",
      "What is recorded about each request?",
      "records",
      "short",
      true,
    ),
  ],
  // ---- Governance documents ----
  tpl_modern_slavery: [
    q(
      "business",
      "Briefly describe your business and supply chains.",
      "background",
    ),
    q(
      "risks",
      "Where are the modern-slavery risks in your operations?",
      "details",
    ),
    q(
      "due_diligence",
      "What due diligence and controls do you have?",
      "details",
    ),
    q(
      "training",
      "What training or awareness is in place?",
      "details",
      "short",
      true,
    ),
    q(
      "approval",
      "Who approves this statement (name, role, date)?",
      "approval",
      "short",
    ),
  ],
  tpl_code_of_conduct: withExtras([
    q(
      "values",
      "What values should the code reflect?",
      "policy_statements",
      "short",
      true,
    ),
    q(
      "behaviours",
      "What behaviours are expected day to day?",
      "policy_statements",
      "long",
      true,
    ),
    q(
      "unacceptable",
      "What is unacceptable (examples)?",
      "policy_statements",
      "long",
      true,
    ),
  ]),
  tpl_board_minutes: [
    q("meeting", "Meeting date, time and location?", "background", "short"),
    q("attendees", "Who attended, and any apologies?", "background", "short"),
    q("agenda", "What was on the agenda?", "details", "short"),
    q("discussions", "Summarise the key discussions.", "details"),
    q("decisions", "What decisions were made?", "decisions"),
    q(
      "actions",
      "Actions agreed (who, what, by when)?",
      "decisions",
      "long",
      true,
    ),
    q("next", "Date of the next meeting?", "approval", "short", true),
  ],
  tpl_written_resolution: [
    q(
      "type",
      "Directors' or members' resolution, and what kind?",
      "background",
      "short",
    ),
    q("resolution", "Set out the resolution text.", "details"),
    q(
      "eligible",
      "Who is eligible to sign or vote?",
      "background",
      "short",
      true,
    ),
    q("passed", "Date passed (or circulation date)?", "approval", "short"),
    q("signatories", "Who signs?", "approval", "short"),
  ],
  // ---- Health & safety procedures ----
  tpl_accident_reporting: [
    q(
      "covers",
      "What counts as a reportable accident, incident or near-miss here?",
      "trigger",
    ),
    q("immediate", "Immediate steps when something happens?", "steps"),
    q(
      "reporting",
      "Who is told, and how is RIDDOR handled?",
      "escalation",
      "short",
    ),
    q("recording", "How and where are incidents recorded?", "records", "short"),
    q(
      "investigation",
      "How are incidents investigated?",
      "steps",
      "long",
      true,
    ),
  ],
  tpl_fire_safety: [
    q("activation", "What happens when the alarm sounds?", "trigger", "short"),
    q("evacuation", "Evacuation steps and routes?", "steps"),
    q("assembly", "Assembly point?", "steps", "short"),
    q("wardens", "Fire wardens / responsible people?", "roles", "short", true),
    q(
      "equipment",
      "Checks on alarms, extinguishers and exits?",
      "records",
      "short",
      true,
    ),
    q("drills", "How often are drills held?", "review_schedule", "short", true),
  ],
  tpl_hs_procedure: [
    q(
      "covers",
      "Which task, activity or hazard does this cover?",
      "trigger",
      "short",
    ),
    q("precautions", "What precautions and controls apply?", "steps"),
    q(
      "safe_steps",
      "Describe the safe way to do the work, step by step.",
      "steps",
    ),
    q("ppe", "Any PPE or equipment required?", "steps", "short", true),
    q(
      "emergency",
      "What to do if something goes wrong?",
      "escalation",
      "short",
    ),
  ],
  // ---- Plans ----
  tpl_disaster_recovery: [
    q("systems", "Which systems and data does this plan cover?", "scenarios"),
    q(
      "activation",
      "What triggers activation, and who decides?",
      "activation",
      "short",
    ),
    q("responsible", "Who does what during recovery?", "roles"),
    q("recovery", "Recovery steps for the key systems?", "recovery"),
    q(
      "objectives",
      "Recovery time / data-loss objectives, if set?",
      "recovery",
      "short",
      true,
    ),
    q(
      "communications",
      "Who is informed, and how?",
      "communications",
      "short",
      true,
    ),
    q("testing", "How is the plan tested?", "testing", "short", true),
  ],
  tpl_incident_response: [
    q(
      "types",
      "What incident types does this cover (cyber, data, outage)?",
      "scenarios",
    ),
    q(
      "detection",
      "How are incidents detected and reported?",
      "activation",
      "short",
    ),
    q("responsible", "Who leads and who supports during an incident?", "roles"),
    q("containment", "Immediate containment steps?", "response"),
    q("recovery", "Eradication and recovery steps?", "recovery", "long", true),
    q(
      "notification",
      "Who might need notifying (ICO, customers, insurers)?",
      "communications",
      "short",
      true,
    ),
    q(
      "lessons",
      "How are lessons captured afterwards?",
      "testing",
      "short",
      true,
    ),
  ],
  // ---- People documents ----
  tpl_rtw: [
    q(
      "when",
      "When are checks carried out (before start, repeat checks)?",
      "trigger",
      "short",
    ),
    q("responsible", "Who performs and signs off checks?", "roles", "short"),
    q("documents", "Which documents or online checks do you accept?", "steps"),
    q("verify", "How do you verify and copy documents?", "steps", "short"),
    q(
      "records",
      "How are check records stored, and for how long?",
      "records",
      "short",
    ),
    q(
      "followup",
      "How do you handle expiring permissions?",
      "review_schedule",
      "short",
      true,
    ),
  ],
  tpl_onboarding: [
    q(
      "before",
      "What happens before day one (contract, checks, kit)?",
      "steps",
    ),
    q("first", "First day / first week essentials?", "steps"),
    q(
      "access",
      "Which systems and access are set up (and by whom)?",
      "steps",
      "short",
    ),
    q("offboarding", "Offboarding steps when someone leaves?", "steps"),
    q(
      "leaver",
      "Property return and access removal on exit?",
      "steps",
      "short",
      true,
    ),
    q("responsible", "Who owns onboarding and offboarding?", "roles", "short"),
  ],
  tpl_probation_review: [
    q("employee", "Employee and role under review?", "trigger", "short"),
    q("period", "Probation period and review date?", "trigger", "short"),
    q(
      "performance",
      "Performance summary - what went well, what needs work?",
      "steps",
    ),
    q("objectives", "Objectives for the next period?", "steps", "long", true),
    q(
      "outcome",
      "Outcome (pass, extend, or not confirmed) and rationale?",
      "steps",
      "short",
    ),
    q("reviewer", "Who conducted the review?", "roles", "short"),
  ],
  tpl_job_description: [
    q("title", "Role title and reporting line?", "details", "short"),
    q(
      "purpose",
      "Purpose of the role in one or two sentences?",
      "purpose",
      "short",
    ),
    q("responsibilities", "Main responsibilities?", "details"),
    q("skills", "Skills, experience and qualifications needed?", "details"),
    q(
      "terms",
      "Key terms worth stating (location, hours, salary band)?",
      "details",
      "short",
      true,
    ),
  ],
};

/**
 * Questions for the guided wizard, resolved document-first:
 * template-specific set -> kind set (contracts, procedures, plans, handbooks,
 * letters, records) -> the template's own policy questionnaire -> base set.
 * Policies keep the original questionnaire unchanged.
 */
export function questionsFor(key: string | null | undefined) {
  const t = getPolicyTemplate(key);
  if (!t) return BASE_QUESTIONS;
  return (
    TEMPLATE_QUESTIONS[t.key] ??
    KIND_QUESTIONS[t.kind ?? "policy"] ??
    t.guidedQuestions
  );
}
