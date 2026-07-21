// Settings, users and audit types for the System / Settings workspace.
// Kept in a separate file to avoid enlarging src/data/types.ts, but
// re-exported and integrated into CoreDataState via that file.

export type SettingsSectionKey =
  | "business"
  | "access"
  | "jova"
  | "notifications"
  | "display"
  | "documents"
  | "data"
  | "audit"
  | "billing"
  | "system";

export type AppRole =
  "owner_admin" | "manager" | "team_member" | "adviser" | "read_only";

export type UserStatus = "active" | "invited" | "deactivated";

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: UserStatus;
  invited_at: string | null;
  last_active_at: string | null;
  areas: string[]; // module keys the user is responsible for
  notes: string;
}

export interface BrandingSettings {
  display_name: string;
  logo_data_url: string | null; // stored locally only
  primary_color: string; // one of the safe palette
  report_footer: string;
}

export interface OperationsAnswers {
  processes_personal_data: boolean;
  employs_staff: boolean;
  uses_contractors: boolean;
  trades_internationally: boolean;
  operates_public_service: boolean;
  regulated_activities: boolean;
  relies_on_external_suppliers: boolean;
}

export interface RegionalSettings {
  country: string;
  currency: string;
  time_zone: string;
  date_format: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  week_starts_on: "monday" | "sunday";
  financial_year_end: string;
}

export interface BusinessProfileExtras {
  trading_name: string;
  company_status: string;
  registered_country: string;
  website: string;
  main_telephone: string;
  main_email: string;
  vat_number: string;
  primary_contact_name: string;
  primary_contact_role: string;
  primary_contact_email: string;
  primary_contact_telephone: string;
}

export interface JovaSettings {
  communication_style: "concise" | "balanced" | "detailed";
  explanation_level: "plain" | "standard" | "advanced";
  morning_briefing_enabled: boolean;
  briefing_include: {
    overdue: boolean;
    risks: boolean;
    compliance: boolean;
    contracts: boolean;
    training: boolean;
    growth: boolean;
  };
  briefing_max_priorities: number;
  show_sources: boolean;
  show_confidence: boolean;
  preserve_context: boolean;
  allow_cross_module: boolean;
  preferred_support_types: string[];
  preferred_adviser_notes: string;
  support_threshold: "standard" | "cautious" | "very_cautious";
  // Locked, never-editable safeguards. Retained for transparency in UI.
  locked: {
    non_advice_boundary: true;
    professional_escalation: true;
    source_uncertainty_disclosure: true;
    prohibit_inventing_facts: true;
    prohibit_fake_monitoring: true;
    prohibit_reveal_unsubmitted_quiz: true;
  };
}

export type NotificationChannel = "in_app" | "email" | "push";
export type NotificationTiming = "immediate" | "daily" | "weekly" | "off";

export interface NotificationCategoryPref {
  key: string;
  label: string;
  group: string;
  in_app: NotificationTiming;
  email: NotificationTiming;
  push: NotificationTiming;
}

export interface NotificationSettings {
  categories: NotificationCategoryPref[];
  escalation_days: number[]; // e.g. [0, 3, 7, 14, 30]
  quiet_hours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;
    weekends_off: boolean;
  };
  channels_available: {
    email_connected: false;
    push_connected: false;
  };
}

export interface DisplaySettings {
  appearance: "light" | "system";
  dark_supported: boolean; // false in prototype
  density: "comfortable" | "compact";
  sidebar_default: "expanded" | "collapsed";
  remember_sidebar: boolean;
  show_section_labels: boolean;
  reduce_nav_animation: boolean;
  text_size: "standard" | "large";
  increased_line_spacing: boolean;
  high_contrast: boolean;
  underline_links: boolean;
  reduce_motion: boolean;
  default_table_view: "table" | "cards";
  rows_per_page: number;
  sticky_headers: boolean;
  wrap_long_text: boolean;
}

export interface ReportDefaults {
  default_period: "this_month" | "last_quarter" | "ytd" | "trailing_12";
  default_status: "draft" | "final";
  include_logo: boolean;
  include_executive_summary: boolean;
  include_source_modules: boolean;
  include_generated_at: boolean;
  include_point_in_time: boolean;
  include_support_statement: boolean;
  print_orientation: "portrait" | "landscape";
  paper_size: "A4";
  page_numbering: boolean;
  report_footer: string;
}

export interface DocumentDefaults {
  draft_status: "Draft - Review Before Use";
  include_company_details: boolean;
  include_version_number: boolean;
  include_generated_date: boolean;
  include_owner: boolean;
  include_review_date: boolean;
  include_professional_review_reminder: boolean;
  default_font_size: "standard" | "large";
  print_header_footer: boolean;
}

export interface CertificateDefaults {
  include_logo: boolean;
  include_completion_date: boolean;
  include_quiz_score: boolean;
  include_duration: boolean;
  include_reference: boolean;
  include_non_accreditation: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  category:
    | "profile"
    | "access"
    | "jova"
    | "notifications"
    | "display"
    | "documents"
    | "data"
    | "settings"
    | "billing"
    | "system";
  target: string;
  summary: string;
  before?: string;
  after?: string;
}

export interface AppSettings {
  schema_version: number;
  business_extras: BusinessProfileExtras;
  regional: RegionalSettings;
  branding: BrandingSettings;
  operations: OperationsAnswers;
  jova: JovaSettings;
  notifications: NotificationSettings;
  display: DisplaySettings;
  report_defaults: ReportDefaults;
  document_defaults: DocumentDefaults;
  certificate_defaults: CertificateDefaults;
  billing: BillingState;
  last_saved_at: string;
  last_saved_by: string;
}

export type BillingPlanId =
  "starter" | "growth" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";
export type BillingStatus = "active_prototype" | "cancelled_prototype";

export interface BillingState {
  plan_id: BillingPlanId;
  cycle: BillingCycle;
  status: BillingStatus;
  changed_at: string;
}

export const SETTINGS_SCHEMA_VERSION = 2;

export const SAFE_BRAND_PALETTE: Array<{ name: string; value: string }> = [
  { name: "Indigo", value: "#3B82F6" },
  { name: "Slate", value: "#334155" },
  { name: "Emerald", value: "#059669" },
  { name: "Rose", value: "#e11d48" },
  { name: "Amber", value: "#d97706" },
  { name: "Violet", value: "#7c3aed" },
];

export const SUPPORT_TYPES = [
  "Solicitor",
  "Accountant",
  "HR adviser",
  "Data-protection adviser/DPO",
  "Tax adviser",
  "Health and safety adviser",
  "Company secretary",
  "Cyber-security specialist",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner_admin: "Owner/Admin",
  manager: "Manager",
  team_member: "Team Member",
  adviser: "Adviser",
  read_only: "Read Only",
};

export interface PermissionRow {
  area: string;
  owner_admin: string;
  manager: string;
  team_member: string;
  adviser: string;
  read_only: string;
}

export const PERMISSIONS_MATRIX: PermissionRow[] = [
  {
    area: "Dashboard & Executive",
    owner_admin: "Full",
    manager: "Full",
    team_member: "View",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "Reports",
    owner_admin: "Manage",
    manager: "Manage",
    team_member: "Create",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "Jova",
    owner_admin: "Full",
    manager: "Full",
    team_member: "Full",
    adviser: "Limited",
    read_only: "View",
  },
  {
    area: "Business modules",
    owner_admin: "Manage",
    manager: "Manage",
    team_member: "Edit",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "Compliance & Governance",
    owner_admin: "Manage",
    manager: "Manage",
    team_member: "Edit",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "Growth",
    owner_admin: "Manage",
    manager: "Manage",
    team_member: "Edit",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "Academy",
    owner_admin: "Manage",
    manager: "Manage",
    team_member: "Learn",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "Settings - general",
    owner_admin: "Manage",
    manager: "Limited",
    team_member: "View",
    adviser: "View",
    read_only: "View",
  },
  {
    area: "User administration",
    owner_admin: "Manage",
    manager: "-",
    team_member: "-",
    adviser: "-",
    read_only: "-",
  },
  {
    area: "Data export",
    owner_admin: "Yes",
    manager: "Yes",
    team_member: "-",
    adviser: "-",
    read_only: "-",
  },
  {
    area: "Data reset",
    owner_admin: "Yes",
    manager: "-",
    team_member: "-",
    adviser: "-",
    read_only: "-",
  },
];

export const NOTIFICATION_CATEGORIES: Array<
  Omit<NotificationCategoryPref, "in_app" | "email" | "push">
> = [
  { key: "briefing", label: "Daily Jova briefing", group: "Core Intelligence" },
  {
    key: "high_priority",
    label: "High-priority actions",
    group: "Core Intelligence",
  },
  { key: "overdue", label: "Overdue actions", group: "Core Intelligence" },
  {
    key: "report_generated",
    label: "Report generated",
    group: "Core Intelligence",
  },
  {
    key: "contract_renewal",
    label: "Contract renewal approaching",
    group: "Business",
  },
  {
    key: "contract_overdue",
    label: "Contract action overdue",
    group: "Business",
  },
  { key: "hr_training", label: "HR training due", group: "Business" },
  { key: "rtw_followup", label: "Right-to-work follow-up", group: "Business" },
  {
    key: "scenario_action",
    label: "Scenario action created",
    group: "Business",
  },
  {
    key: "supplier_review",
    label: "Relationship or supplier review",
    group: "Business",
  },
  {
    key: "compliance_due",
    label: "Compliance obligation due",
    group: "Compliance & Governance",
  },
  {
    key: "filing_overdue",
    label: "Filing overdue",
    group: "Compliance & Governance",
  },
  {
    key: "privacy_review",
    label: "Privacy notice review",
    group: "Compliance & Governance",
  },
  {
    key: "data_request",
    label: "Data request deadline",
    group: "Compliance & Governance",
  },
  {
    key: "breach_action",
    label: "Data breach action",
    group: "Compliance & Governance",
  },
  {
    key: "governance_approval",
    label: "Governance approval",
    group: "Compliance & Governance",
  },
  {
    key: "policy_review",
    label: "Policy review",
    group: "Compliance & Governance",
  },
  {
    key: "risk_review",
    label: "Risk review or mitigation overdue",
    group: "Compliance & Governance",
  },
  { key: "investor_gap", label: "Investor-readiness gap", group: "Growth" },
  {
    key: "data_room_missing",
    label: "Data-room item missing",
    group: "Growth",
  },
  { key: "tender_deadline", label: "Tender deadline", group: "Growth" },
  { key: "tender_evidence", label: "Tender evidence missing", group: "Growth" },
  {
    key: "bid_decision",
    label: "Bid/No-Bid decision pending",
    group: "Growth",
  },
  { key: "course_assigned", label: "Course assigned", group: "Academy" },
  { key: "course_due", label: "Course due soon", group: "Academy" },
  { key: "course_overdue", label: "Course overdue", group: "Academy" },
  { key: "quiz_completed", label: "Quiz completed", group: "Academy" },
  {
    key: "certificate_generated",
    label: "Certificate generated",
    group: "Academy",
  },
];
