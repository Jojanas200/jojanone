export type ModuleKey =
  | "dashboard"
  | "executive"
  | "timeline"
  | "reports"
  | "jova"
  | "simulator"
  | "business-map"
  | "contracts"
  | "hr"
  | "compliance"
  | "gdpr"
  | "governance"
  | "risk"
  | "investor-ready"
  | "tender-ready"
  | "academy"
  | "settings";

export type {
  AppSettings,
  AppUser,
  AppRole,
  UserStatus,
  AuditEvent,
  NotificationCategoryPref,
  NotificationSettings,
  DisplaySettings,
  JovaSettings,
  ReportDefaults,
  DocumentDefaults,
  CertificateDefaults,
  BusinessProfileExtras,
  RegionalSettings,
  BrandingSettings,
  OperationsAnswers,
  SettingsSectionKey,
  PermissionRow,
} from "./settings-types";

import type { AppSettings, AppUser, AuditEvent } from "./settings-types";

export type ActivityStatus =
  "open" | "in_progress" | "overdue" | "upcoming" | "completed" | "info";

export type Priority = "high" | "medium" | "low" | "none";

export type ActivityType =
  | "obligation"
  | "filing"
  | "review"
  | "policy"
  | "contract"
  | "risk"
  | "decision"
  | "report"
  | "system"
  | "training"
  | "meeting";

export interface Activity {
  id: string;
  business_id: string;
  activity_type: ActivityType;
  module: ModuleKey;
  title: string;
  description: string;
  status: ActivityStatus;
  priority: Priority;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  due_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export type ReportType =
  | "executive_summary"
  | "business_confidence"
  | "compliance_overview"
  | "risk_summary"
  | "monthly_activity"
  | "training_summary";

export type ReportStatus = "draft" | "final";

export interface ReportSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface Report {
  id: string;
  business_id: string;
  report_type: ReportType;
  title: string;
  reporting_period: string;
  status: ReportStatus;
  summary: string;
  sections: ReportSection[];
  metrics: Array<{ label: string; value: string; hint?: string }>;
  findings: string[];
  priority_actions: string[];
  source_modules: ModuleKey[];
  created_at: string;
  updated_at: string;
}

export type JovaSender = "user" | "jova";

export interface JovaMessage {
  id: string;
  conversation_id: string;
  sender: JovaSender;
  content: string;
  reference_type: string | null;
  reference_id: string | null;
  suggested_action: {
    label: string;
    kind: "navigate" | "generate_report" | "open_activity" | "open_report";
    target?: string;
  } | null;
  structured?: {
    items?: Array<{
      title: string;
      subtitle?: string;
      module?: ModuleKey;
      id?: string;
    }>;
    metric?: { label: string; value: string };
    disclaimer?: string;
    factors?: Array<{ label: string; score: number; note: string }>;
    choices?: Array<{ label: string; prompt: string }>;
  };
  created_at: string;
}

export interface JovaConversation {
  id: string;
  business_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  kind: "priority" | "report" | "insight" | "risk";
  title: string;
  description: string;
  reference_type: "activity" | "report" | "conversation" | null;
  reference_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Decision {
  id: string;
  title: string;
  reason: string;
  deadline: string;
  risk_level: "high" | "medium" | "low";
  status: "pending" | "approved" | "deferred" | "reviewed";
  module: ModuleKey;
}

export interface BusinessAreaSummary {
  key: "compliance" | "contracts" | "gdpr" | "hr" | "governance" | "risk";
  label: string;
  module: ModuleKey;
  status: "good" | "attention" | "risk";
  score: number;
  summary: string;
  top_concern: string;
}

export interface ConfidenceFactor {
  label: string;
  score: number;
  weight: number;
  note: string;
  module: ModuleKey;
}

export interface BusinessSnapshot {
  score: number;
  status_label: "Good" | "Needs Attention" | "At Risk";
  change: number;
  explanation: string;
  open_priorities: number;
  overdue_actions: number;
  upcoming_actions: number;
  completed_this_month: number;
  active_risks: number;
  high_priority_risks: number;
  compliance_position: "On track" | "Minor gaps" | "Significant gaps";
  last_updated: string;
  factors: ConfidenceFactor[];
}

export interface CoreDataState {
  business: { id: string; name: string; owner: string };
  activities: Activity[];
  reports: Report[];
  conversations: JovaConversation[];
  messages: JovaMessage[];
  notifications: Notification[];
  decisions: Decision[];
  areas: BusinessAreaSummary[];
  last_refreshed: string;
  business_profile: BusinessProfile;
  business_entities: BusinessEntity[];
  contracts: Contract[];
  employees: Employee[];
  hr_actions: HrAction[];
  scenario_runs: ScenarioRun[];
  compliance_obligations: ComplianceObligation[];
  compliance_evidence: ComplianceEvidence[];
  gdpr_assessments: GdprAssessment[];
  processing_activities: ProcessingActivity[];
  data_requests: DataRequest[];
  data_breaches: DataBreach[];
  dpias: Dpia[];
  privacy_notices: PrivacyNotice[];
  governance_records: GovernanceRecord[];
  policies: Policy[];
  risks: Risk[];
  investor_profiles: InvestorProfile[];
  investor_readiness_assessments: InvestorReadinessAssessment[];
  due_diligence_items: DueDiligenceItem[];
  data_room_items: DataRoomItem[];
  tender_opportunities: TenderOpportunity[];
  bid_assessments: BidAssessment[];
  tender_requirements: TenderRequirement[];
  tender_responses: TenderResponse[];
  evidence_library_items: EvidenceLibraryItem[];
  academy_assignments: AcademyAssignment[];
  academy_progress: AcademyProgress[];
  academy_quiz_attempts: AcademyQuizAttempt[];
  academy_certificates: AcademyCertificate[];
  app_settings: AppSettings;
  app_users: AppUser[];
  audit_events: AuditEvent[];
}

// ---- Business profile ------------------------------------------------

export interface BusinessProfile {
  id: string;
  business_name: string;
  company_number: string;
  business_type: string;
  industry: string;
  incorporation_date: string;
  registered_address: string;
  trading_address: string;
  financial_year_end: string;
  employee_count: number;
  contractor_count: number;
  customer_count: number;
  supplier_count: number;
  annual_revenue_band: string;
  vat_registered: boolean;
  employer_registered: boolean;
  processes_personal_data: boolean;
  trades_internationally: boolean;
  profile_completion: number;
  updated_at: string;
}

export type EntityType =
  | "customer"
  | "supplier"
  | "employee"
  | "contractor"
  | "adviser"
  | "regulator"
  | "partner"
  | "insurer"
  | "bank";

export type EntityStatus =
  "active" | "review_due" | "at_risk" | "archived" | "missing_info";

export interface BusinessEntity {
  id: string;
  business_id: string;
  entity_type: EntityType;
  name: string;
  relationship: string;
  status: EntityStatus;
  importance: "high" | "medium" | "low";
  risk_level: "high" | "medium" | "low";
  contract_id: string | null;
  contact_name: string;
  email: string;
  start_date: string | null;
  review_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ContractStatus =
  "active" | "draft" | "expired" | "archived" | "pending_signature";
export type ContractType =
  | "customer"
  | "supplier"
  | "employment"
  | "contractor"
  | "software"
  | "office"
  | "dpa"
  | "insurance"
  | "nda"
  | "other";

export interface Contract {
  id: string;
  business_id: string;
  contract_type: ContractType;
  title: string;
  counterparty: string;
  status: ContractStatus;
  value: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  notice_period_days: number | null;
  owner: string;
  risk_level: "high" | "medium" | "low";
  key_terms: string;
  obligations: string;
  next_action: string;
  next_action_date: string | null;
  notes: string;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export type EmploymentType =
  "employee" | "contractor" | "consultant" | "intern";
export type EmploymentStatus = "active" | "probation" | "notice" | "archived";

export interface Employee {
  id: string;
  business_id: string;
  full_name: string;
  job_title: string;
  department: string;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  start_date: string;
  probation_end_date: string | null;
  contract_status: "signed" | "pending" | "missing";
  right_to_work_status: "verified" | "outstanding" | "expired" | "not_required";
  right_to_work_expiry: string | null;
  policy_acknowledgement_status: "complete" | "outstanding";
  training_status: "complete" | "outstanding" | "overdue";
  emergency_contact_recorded: boolean;
  next_review_date: string | null;
  risk_level: "high" | "medium" | "low";
  notes: string;
  created_at: string;
  updated_at: string;
}

export type HrActionType =
  | "right_to_work"
  | "probation_review"
  | "contract_issue"
  | "training"
  | "policy_ack"
  | "performance_review"
  | "return_to_work"
  | "welfare"
  | "document_renewal";

export interface HrAction {
  id: string;
  business_id: string;
  employee_id: string;
  action_type: HrActionType;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "completed" | "deferred";
  due_date: string | null;
  completed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ScenarioType =
  | "hire_employee"
  | "engage_contractor"
  | "new_customer"
  | "new_supplier"
  | "launch_website"
  | "expand_market"
  | "raise_investment"
  | "prepare_tender"
  | "introduce_ai"
  | "new_personal_data";

export interface ScenarioResult {
  summary: string;
  readiness: "ready" | "mostly_ready" | "gaps" | "significant_gaps";
  impact_level: "high" | "medium" | "low";
  affected_modules: ModuleKey[];
  considerations: string[];
  risks: string[];
  required_actions: Array<{
    label: string;
    module: ModuleKey;
    priority: "high" | "medium" | "low";
  }>;
  recommended_documents: string[];
  suggested_deadlines: string[];
  professional_support: string[];
}

export interface ScenarioRun {
  id: string;
  business_id: string;
  scenario_type: ScenarioType;
  scenario_name: string;
  answers: Record<string, unknown>;
  result: ScenarioResult;
  status: "draft" | "saved" | "archived";
  created_at: string;
  updated_at: string;
}

// ---- Compliance & Governance ----------------------------------------

export type ObligationCategory =
  | "companies_house"
  | "tax"
  | "vat"
  | "payroll"
  | "pensions"
  | "insurance"
  | "employment"
  | "data_protection"
  | "health_safety"
  | "insurance_business"
  | "governance"
  | "other";

export type Applicability = "applicable" | "not_applicable" | "unclear";
export type ObligationStatus =
  | "action_required"
  | "in_progress"
  | "completed"
  | "overdue"
  | "upcoming"
  | "not_applicable";

export interface ComplianceObligation {
  id: string;
  business_id: string;
  title: string;
  category: ObligationCategory;
  regulator: string;
  jurisdiction: string;
  description: string;
  plain_language_explanation: string;
  reason_applies: string;
  applicability_status: Applicability;
  priority: "high" | "medium" | "low";
  status: ObligationStatus;
  due_date: string | null;
  recurrence: "none" | "annual" | "quarterly" | "monthly" | "weekly";
  source_type: string;
  source_reference: string;
  required_action: string;
  required_evidence: string[];
  evidence_status: "not_started" | "in_progress" | "complete";
  owner: string;
  professional_support_required: boolean;
  completed_at: string | null;
  next_due_date: string | null;
  notes: string;
  na_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceEvidence {
  id: string;
  business_id: string;
  obligation_id: string;
  evidence_type: string;
  title: string;
  description: string;
  file_name: string;
  reference: string;
  review_date: string | null;
  status: "recorded" | "expired" | "pending";
  created_at: string;
  updated_at: string;
}

export interface GdprAssessment {
  id: string;
  business_id: string;
  assessment_type: "health_check";
  answers: Record<string, "yes" | "no" | "unsure">;
  score: number;
  status: "draft" | "completed";
  gaps: string[];
  recommendations: Array<{
    label: string;
    priority: "high" | "medium" | "low";
  }>;
  completed_at: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingActivity {
  id: string;
  business_id: string;
  activity_name: string;
  business_purpose: string;
  data_subjects: string;
  personal_data_categories: string;
  special_category_data: boolean;
  lawful_basis: string;
  recipients: string;
  processors: string;
  international_transfers: boolean;
  retention_period: string;
  security_measures: string;
  owner: string;
  status: "active" | "archived";
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

export type DataRequestType =
  | "subject_access"
  | "rectification"
  | "erasure"
  | "restriction"
  | "objection"
  | "portability";

export interface DataRequest {
  id: string;
  business_id: string;
  request_type: DataRequestType;
  requester_reference: string;
  received_date: string;
  identity_verified: boolean;
  due_date: string;
  status: "open" | "in_progress" | "completed" | "closed";
  assigned_owner: string;
  notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataBreach {
  id: string;
  business_id: string;
  title: string;
  discovered_at: string;
  occurred_at: string | null;
  description: string;
  data_involved: string;
  affected_people_estimate: number;
  risk_level: "low" | "medium" | "high";
  containment_actions: string;
  ico_notification_assessment: string;
  individual_notification_assessment: string;
  status: "open" | "contained" | "closed";
  owner: string;
  professional_support_required: boolean;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dpia {
  id: string;
  business_id: string;
  title: string;
  project: string;
  processing_summary: string;
  necessity: string;
  risks: string;
  controls: string;
  residual_risk: "low" | "medium" | "high";
  status: "draft" | "approved" | "review_due";
  owner: string;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyNotice {
  id: string;
  business_id: string;
  version: string;
  status: "draft" | "published";
  organisation: string;
  contact_details: string;
  data_collected: string;
  purposes: string;
  lawful_bases: string[];
  sharing: string;
  international_transfers: string;
  retention: string;
  rights: string;
  complaints: string;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

export type GovernanceRecordType =
  | "board_meeting"
  | "written_resolution"
  | "director_decision"
  | "shareholder_decision"
  | "meeting_minutes"
  | "governance_review";

export interface GovernanceRecord {
  id: string;
  business_id: string;
  record_type: GovernanceRecordType;
  title: string;
  description: string;
  meeting_date: string | null;
  decision_date: string | null;
  owner: string;
  status:
    "draft" | "pending" | "approved" | "deferred" | "rejected" | "completed";
  review_date: string | null;
  approval_status: "unapproved" | "approved";
  participants: string;
  actions: string;
  linked_document: string;
  notes: string;
  background?: string;
  options_considered?: string;
  risks_considered?: string;
  decision?: string;
  decision_maker?: string;
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: string;
  business_id: string;
  policy_name: string;
  policy_category: string;
  version: string;
  owner: string;
  status: "draft" | "active" | "archived";
  approval_date: string | null;
  review_date: string | null;
  acknowledgement_required: boolean;
  acknowledgement_status: "complete" | "partial" | "not_started";
  notes: string;
  created_at: string;
  updated_at: string;
}

export type RiskCategory =
  | "compliance"
  | "contracts"
  | "data_protection"
  | "cyber"
  | "people"
  | "financial"
  | "operational"
  | "supplier"
  | "strategic";

export type RiskResponse =
  "avoid" | "reduce" | "transfer" | "accept" | "monitor";
export type RiskRating = "low" | "medium" | "high" | "critical";

export interface Risk {
  id: string;
  business_id: string;
  risk_title: string;
  risk_category: RiskCategory;
  description: string;
  cause: string;
  consequence: string;
  likelihood: number; // 1-5
  impact: number; // 1-5
  inherent_score: number;
  inherent_rating: RiskRating;
  controls: string;
  control_effectiveness: "strong" | "adequate" | "weak" | "none";
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  residual_rating: RiskRating;
  risk_owner: string;
  response: RiskResponse;
  mitigation_actions: Array<{
    id: string;
    label: string;
    due_date: string | null;
    status: "open" | "completed";
    completed_at: string | null;
  }>;
  status: "open" | "accepted" | "closed";
  review_date: string | null;
  accepted_at: string | null;
  closed_at: string | null;
  acceptance_reason?: string;
  closure_reason?: string;
  linked_contract_id: string | null;
  linked_entity_id: string | null;
  linked_employee_id: string | null;
  linked_obligation_id: string | null;
  linked_processing_activity_id: string | null;
  linked_governance_record_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Growth ---------------------------------------------------------

export type FundingStage =
  "pre_seed" | "seed" | "early_growth" | "series_a" | "growth";
export type InvestmentType =
  "equity" | "convertible" | "loan" | "grant" | "undecided";
export type InvestorProfileStatus =
  "preparing" | "in_market" | "closed" | "on_hold";

export interface InvestorProfile {
  id: string;
  business_id: string;
  funding_stage: FundingStage;
  amount_sought: number;
  currency: string;
  funding_purpose: string;
  target_close_date: string | null;
  current_revenue_band: string;
  growth_summary: string;
  traction_summary: string;
  market_summary: string;
  team_summary: string;
  investment_type: InvestmentType;
  status: InvestorProfileStatus;
  created_at: string;
  updated_at: string;
}

export type DDCategory =
  | "corporate"
  | "financial"
  | "legal"
  | "compliance"
  | "commercial"
  | "people"
  | "data_room";

export type DDStatus =
  "missing" | "in_progress" | "ready" | "needs_review" | "not_applicable";

export interface DueDiligenceItem {
  id: string;
  business_id: string;
  category: DDCategory;
  title: string;
  description: string;
  required: boolean;
  status: DDStatus;
  evidence_reference: string;
  source_module: string | null;
  source_record_id: string | null;
  owner: string;
  priority: "high" | "medium" | "low";
  review_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type DataRoomFolder =
  | "corporate"
  | "ownership"
  | "financial"
  | "tax"
  | "commercial"
  | "contracts"
  | "people"
  | "ip"
  | "compliance"
  | "gdpr"
  | "governance"
  | "risk_insurance"
  | "investor_materials";

export type DataRoomStatus =
  "missing" | "in_progress" | "ready" | "needs_review" | "archived";

export interface DataRoomItem {
  id: string;
  business_id: string;
  folder: DataRoomFolder;
  title: string;
  document_type: string;
  version: string;
  status: DataRoomStatus;
  file_name: string;
  source_module: string | null;
  source_record_id: string | null;
  confidentiality: "standard" | "confidential" | "restricted";
  review_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InvestorReadinessAssessment {
  id: string;
  business_id: string;
  answers: Record<string, string>;
  overall_score: number;
  corporate_score: number;
  financial_score: number;
  legal_score: number;
  compliance_score: number;
  commercial_score: number;
  people_score: number;
  data_room_score: number;
  gaps: string[];
  red_flags: string[];
  recommended_actions: Array<{
    label: string;
    category: DDCategory;
    priority: "high" | "medium" | "low";
  }>;
  status: "draft" | "completed";
  completed_at: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

export type TenderStatus =
  | "identified"
  | "assessing"
  | "bid"
  | "no_bid"
  | "drafting"
  | "review"
  | "submitted"
  | "won"
  | "lost"
  | "archived";

export type TenderProcedure =
  "open" | "restricted" | "framework" | "direct_award" | "quotation" | "other";

export interface TenderOpportunity {
  id: string;
  business_id: string;
  title: string;
  authority: string;
  reference: string;
  sector: string;
  location: string;
  contract_value: number;
  currency: string;
  publication_date: string | null;
  clarification_deadline: string | null;
  submission_deadline: string | null;
  contract_start_date: string | null;
  contract_duration: string;
  procedure_type: TenderProcedure;
  status: TenderStatus;
  source: string;
  summary: string;
  eligibility_notes: string;
  owner: string;
  created_at: string;
  updated_at: string;
}

export interface BidAssessment {
  id: string;
  business_id: string;
  opportunity_id: string;
  strategic_fit_score: number;
  eligibility_score: number;
  capacity_score: number;
  evidence_score: number;
  commercial_score: number;
  delivery_risk_score: number;
  overall_score: number;
  answers: Record<string, string>;
  strengths: string[];
  gaps: string[];
  risks: string[];
  recommendation: "bid" | "no_bid" | "conditional";
  decision: "bid" | "no_bid" | "pending";
  decision_reason: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TenderReqType =
  | "eligibility"
  | "pass_fail"
  | "technical"
  | "quality"
  | "commercial"
  | "social_value"
  | "legal"
  | "submission";

export type TenderReqStatus =
  | "not_started"
  | "in_progress"
  | "evidence_missing"
  | "ready_for_review"
  | "complete"
  | "not_applicable";

export interface TenderRequirement {
  id: string;
  business_id: string;
  opportunity_id: string;
  requirement_type: TenderReqType;
  title: string;
  description: string;
  mandatory: boolean;
  weighting: number;
  status: TenderReqStatus;
  owner: string;
  due_date: string | null;
  evidence_reference: string;
  response_id: string | null;
  source_section: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type TenderResponseStatus =
  "draft" | "in_progress" | "ready_for_review" | "approved";

export interface TenderResponse {
  id: string;
  business_id: string;
  opportunity_id: string;
  requirement_id: string;
  section_title: string;
  question: string;
  word_limit: number;
  response_text: string;
  status: TenderResponseStatus;
  review_notes: string;
  version: number;
  owner: string;
  created_at: string;
  updated_at: string;
}

export type EvidenceCategory =
  | "corporate"
  | "financial"
  | "insurance"
  | "policies"
  | "compliance"
  | "data_protection"
  | "cyber_security"
  | "health_safety"
  | "equality"
  | "business_continuity"
  | "environmental"
  | "social_value"
  | "experience"
  | "references"
  | "certifications";

export interface EvidenceLibraryItem {
  id: string;
  business_id: string;
  category: EvidenceCategory;
  title: string;
  description: string;
  source_module: string | null;
  source_record_id: string | null;
  status: "current" | "expired" | "in_review" | "archived";
  review_date: string | null;
  file_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ---- Academy -------------------------------------------------------

export type LearnerId = string; // "owner" or an Employee id
export type AssignmentStatus =
  "assigned" | "in_progress" | "completed" | "overdue";

export interface AcademyAssignment {
  id: string;
  business_id: string;
  learner_id: LearnerId;
  learner_name: string;
  course_id: string;
  assigned_by: string;
  due_date: string | null;
  status: AssignmentStatus;
  required_by_company: boolean;
  legally_required: boolean;
  external_completion_note: string;
  reason?: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AcademyProgress {
  id: string;
  business_id: string;
  learner_id: LearnerId;
  course_id: string;
  lessons_completed: string[];
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  time_minutes: number;
}

export interface AcademyQuizAttempt {
  id: string;
  business_id: string;
  learner_id: LearnerId;
  course_id: string;
  score: number;
  passed: boolean;
  answers: Record<string, number>;
  taken_at: string;
}

export interface AcademyCertificate {
  id: string;
  business_id: string;
  reference: string;
  learner_id: LearnerId;
  learner_name: string;
  course_id: string;
  course_title: string;
  completed_at: string;
  quiz_score: number;
  duration_minutes: number;
}
