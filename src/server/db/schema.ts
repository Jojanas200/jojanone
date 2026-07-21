// -----------------------------------------------------------------------------
// Drizzle schema - STARTER (hand-written).
//
// The source of truth for the database is the SQL in supabase/migrations
// (RLS policies, functions, triggers, storage - Drizzle can't express those).
// This file only provides typed table definitions for the query builder.
//
// Once a database is available, regenerate the FULL 53-table schema from it:
//     bun run db:pull        # drizzle-kit pull → overwrites this file + relations.ts
//
// Until then, this starter covers the tables needed for the first vertical
// slice (onboarding + contracts). Keep it in sync with the migrations, or pull.
// -----------------------------------------------------------------------------
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums (must match the names created in the SQL migrations) --------------
export const appRole = pgEnum("app_role", [
  "owner_admin",
  "manager",
  "team_member",
  "adviser",
  "read_only",
]);
export const riskBand = pgEnum("risk_band", ["low", "medium", "high"]);
export const priorityLevel = pgEnum("priority_level", [
  "high",
  "medium",
  "low",
  "none",
]);
export const contractStatus = pgEnum("contract_status", [
  "active",
  "draft",
  "expired",
  "archived",
  "pending_signature",
]);
export const contractType = pgEnum("contract_type", [
  "customer",
  "supplier",
  "employment",
  "contractor",
  "software",
  "office",
  "dpa",
  "insurance",
  "nda",
  "other",
]);
export const obligationCategory = pgEnum("obligation_category", [
  "companies_house",
  "tax",
  "vat",
  "payroll",
  "pensions",
  "insurance",
  "employment",
  "data_protection",
  "health_safety",
  "insurance_business",
  "governance",
  "other",
]);
export const applicability = pgEnum("applicability", [
  "applicable",
  "not_applicable",
  "unclear",
]);
export const obligationStatus = pgEnum("obligation_status", [
  "action_required",
  "in_progress",
  "completed",
  "overdue",
  "upcoming",
  "not_applicable",
]);
export const riskCategory = pgEnum("risk_category", [
  "compliance",
  "contracts",
  "data_protection",
  "cyber",
  "people",
  "financial",
  "operational",
  "supplier",
  "strategic",
]);
export const riskResponse = pgEnum("risk_response", [
  "avoid",
  "reduce",
  "transfer",
  "accept",
  "monitor",
]);
export const riskRating = pgEnum("risk_rating", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const employmentType = pgEnum("employment_type", [
  "employee",
  "contractor",
  "consultant",
  "intern",
]);
export const employmentStatus = pgEnum("employment_status", [
  "active",
  "probation",
  "notice",
  "archived",
]);
export const governanceRecordType = pgEnum("governance_record_type", [
  "board_meeting",
  "written_resolution",
  "director_decision",
  "shareholder_decision",
  "meeting_minutes",
  "governance_review",
]);
export const tenderStatus = pgEnum("tender_status", [
  "identified",
  "assessing",
  "bid",
  "no_bid",
  "drafting",
  "review",
  "submitted",
  "won",
  "lost",
  "archived",
]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

// --- organisations -----------------------------------------------------------
export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- workspaces --------------------------------------------------------------
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull(),
  name: text("name").notNull(),
  brandColor: text("brand_color"),
  timeZone: text("time_zone").notNull().default("Europe/London"),
  suspendedAt: ts("suspended_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- platform_audit_log (operator actions; service-role only) -----------------
export const platformAuditLog = pgTable("platform_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id"),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  targetWorkspaceId: uuid("target_workspace_id"),
  targetUserId: uuid("target_user_id"),
  detail: jsonb("detail").notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// --- tenant_notes (internal operator notes; service-role only) ---------------
export const tenantNotes = pgTable("tenant_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  authorEmail: text("author_email"),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// --- platform_settings (singleton cross-tenant config; service-role only) -----
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("singleton"),
  aiProvider: text("ai_provider").notNull().default("anthropic"),
  aiModel: text("ai_model"),
  signupsEnabled: boolean("signups_enabled").notNull().default(true),
  announcement: text("announcement"),
  announcementLevel: text("announcement_level").notNull().default("info"),
  featureFlags: jsonb("feature_flags").notNull().default({}),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
  updatedByEmail: text("updated_by_email"),
});

// --- platform_events (cross-tenant product usage stream; service-role only) ---
export const platformEvents = pgTable("platform_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id"),
  userId: uuid("user_id"),
  name: text("name").notNull(),
  module: text("module"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// --- user_preferences (per-user UI prefs; RLS self-access) -------------------
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  theme: text("theme").notNull().default("default"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- memberships (user <-> workspace + role) ---------------------------------
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: appRole("role").notNull().default("team_member"),
  scopedModules: text("scoped_modules").array(),
  expiresAt: ts("expires_at"),
  invitedBy: uuid("invited_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- invitations (pending team invites; token stored hashed) -----------------
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  email: text("email").notNull(),
  role: appRole("role").notNull(),
  scopedModules: text("scoped_modules").array(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- business_profiles (one per workspace) -----------------------------------
export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().unique(),
  businessName: text("business_name").notNull().default(""),
  companyNumber: text("company_number"),
  businessType: text("business_type"),
  industry: text("industry"),
  incorporationDate: date("incorporation_date"),
  registeredAddress: text("registered_address"),
  tradingAddress: text("trading_address"),
  financialYearEnd: text("financial_year_end"),
  employeeCount: integer("employee_count").notNull().default(0),
  contractorCount: integer("contractor_count").notNull().default(0),
  customerCount: integer("customer_count").notNull().default(0),
  supplierCount: integer("supplier_count").notNull().default(0),
  annualRevenueBand: text("annual_revenue_band"),
  vatRegistered: boolean("vat_registered").notNull().default(false),
  employerRegistered: boolean("employer_registered").notNull().default(false),
  processesPersonalData: boolean("processes_personal_data")
    .notNull()
    .default(false),
  tradesInternationally: boolean("trades_internationally")
    .notNull()
    .default(false),
  profileCompletion: integer("profile_completion").notNull().default(0),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- onboarding_responses (one per workspace; answers keyed by field id) ------
export const onboardingResponses = pgTable("onboarding_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().unique(),
  answers: jsonb("answers")
    .notNull()
    .default({})
    .$type<Record<string, unknown>>(),
  completedAt: ts("completed_at"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- contracts ---------------------------------------------------------------
export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  contractType: contractType("contract_type").notNull(),
  title: text("title").notNull(),
  counterparty: text("counterparty").notNull().default(""),
  status: contractStatus("status").notNull().default("draft"),
  currency: text("currency").notNull().default("GBP"),
  valueMinor: bigint("value_minor", { mode: "number" }).notNull().default(0),
  startDate: date("start_date"),
  endDate: date("end_date"),
  renewalDate: date("renewal_date"),
  noticePeriodDays: integer("notice_period_days"),
  owner: text("owner"),
  riskLevel: riskBand("risk_level").notNull().default("low"),
  keyTerms: text("key_terms"),
  obligations: text("obligations"),
  nextAction: text("next_action"),
  nextActionDate: date("next_action_date"),
  notes: text("notes"),
  entityId: uuid("entity_id"),
  source: text("source"),
  sourceReference: text("source_reference"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

// --- compliance_obligations --------------------------------------------------
export const complianceObligations = pgTable("compliance_obligations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  title: text("title").notNull(),
  category: obligationCategory("category").notNull().default("other"),
  regulator: text("regulator"),
  jurisdiction: text("jurisdiction"),
  description: text("description"),
  plainLanguageExplanation: text("plain_language_explanation"),
  reasonApplies: text("reason_applies"),
  applicabilityStatus: applicability("applicability_status")
    .notNull()
    .default("applicable"),
  priority: priorityLevel("priority").notNull().default("medium"),
  status: obligationStatus("status").notNull().default("upcoming"),
  dueDate: date("due_date"),
  recurrence: text("recurrence").notNull().default("none"),
  sourceType: text("source_type"),
  sourceReference: text("source_reference"),
  requiredAction: text("required_action"),
  requiredEvidence: text("required_evidence").array().notNull().default([]),
  evidenceStatus: text("evidence_status").notNull().default("not_started"),
  owner: text("owner"),
  professionalSupportRequired: boolean("professional_support_required")
    .notNull()
    .default(false),
  completedAt: ts("completed_at"),
  nextDueDate: date("next_due_date"),
  notes: text("notes"),
  naReason: text("na_reason"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

// --- risks -------------------------------------------------------------------
export const risks = pgTable("risks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  riskTitle: text("risk_title").notNull(),
  riskCategory: riskCategory("risk_category").notNull().default("operational"),
  description: text("description"),
  cause: text("cause"),
  consequence: text("consequence"),
  likelihood: integer("likelihood"),
  impact: integer("impact"),
  inherentScore: integer("inherent_score"),
  inherentRating: riskRating("inherent_rating"),
  controls: text("controls"),
  controlEffectiveness: text("control_effectiveness"),
  residualLikelihood: integer("residual_likelihood"),
  residualImpact: integer("residual_impact"),
  residualScore: integer("residual_score"),
  residualRating: riskRating("residual_rating"),
  riskOwner: text("risk_owner"),
  response: riskResponse("response").notNull().default("monitor"),
  status: text("status").notNull().default("open"),
  reviewDate: date("review_date"),
  acceptedAt: ts("accepted_at"),
  closedAt: ts("closed_at"),
  acceptanceReason: text("acceptance_reason"),
  closureReason: text("closure_reason"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

// --- employees ---------------------------------------------------------------
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  department: text("department"),
  employmentType: employmentType("employment_type")
    .notNull()
    .default("employee"),
  employmentStatus: employmentStatus("employment_status")
    .notNull()
    .default("active"),
  startDate: date("start_date"),
  probationEndDate: date("probation_end_date"),
  contractStatus: text("contract_status").notNull().default("missing"),
  rightToWorkStatus: text("right_to_work_status")
    .notNull()
    .default("outstanding"),
  rightToWorkExpiry: date("right_to_work_expiry"),
  policyAcknowledgementStatus: text("policy_acknowledgement_status")
    .notNull()
    .default("outstanding"),
  trainingStatus: text("training_status").notNull().default("outstanding"),
  emergencyContactRecorded: boolean("emergency_contact_recorded")
    .notNull()
    .default(false),
  nextReviewDate: date("next_review_date"),
  riskLevel: riskBand("risk_level").notNull().default("low"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

// --- processing_activities (ROPA) --------------------------------------------
export const processingActivities = pgTable("processing_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  activityName: text("activity_name").notNull(),
  businessPurpose: text("business_purpose"),
  dataSubjects: text("data_subjects"),
  personalDataCategories: text("personal_data_categories"),
  specialCategoryData: boolean("special_category_data")
    .notNull()
    .default(false),
  lawfulBasis: text("lawful_basis"),
  recipients: text("recipients"),
  processors: text("processors"),
  internationalTransfers: boolean("international_transfers")
    .notNull()
    .default(false),
  retentionPeriod: text("retention_period"),
  securityMeasures: text("security_measures"),
  owner: text("owner"),
  status: text("status").notNull().default("active"),
  reviewDate: date("review_date"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- governance_records ------------------------------------------------------
export const governanceRecords = pgTable("governance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  recordType: governanceRecordType("record_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  meetingDate: date("meeting_date"),
  decisionDate: date("decision_date"),
  owner: text("owner"),
  status: text("status").notNull().default("draft"),
  reviewDate: date("review_date"),
  approvalStatus: text("approval_status").notNull().default("unapproved"),
  participants: text("participants"),
  actions: text("actions"),
  linkedDocument: text("linked_document"),
  notes: text("notes"),
  background: text("background"),
  optionsConsidered: text("options_considered"),
  risksConsidered: text("risks_considered"),
  decision: text("decision"),
  decisionMaker: text("decision_maker"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- policies (company policy register; table + RLS from migration 0003/0005) -
export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  policyName: text("policy_name").notNull(),
  policyCategory: text("policy_category"),
  version: text("version").notNull().default("1.0"),
  owner: text("owner"),
  status: text("status").notNull().default("draft"), // draft | active | archived
  approvalDate: date("approval_date"),
  reviewDate: date("review_date"),
  acknowledgementRequired: boolean("acknowledgement_required")
    .notNull()
    .default(false),
  acknowledgementStatus: text("acknowledgement_status")
    .notNull()
    .default("not_started"), // not_started | partial | complete
  notes: text("notes"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- policy_acknowledgements (per-employee sign-off on a policy) --------------
export const policyAcknowledgements = pgTable("policy_acknowledgements", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  policyId: uuid("policy_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | acknowledged | waived
  acknowledgedAt: ts("acknowledged_at"),
  policyVersion: text("policy_version"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- due_diligence_items (Investor Ready) ------------------------------------
export const dueDiligenceItems = pgTable("due_diligence_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(true),
  status: text("status").notNull().default("missing"),
  evidenceReference: text("evidence_reference"),
  sourceModule: text("source_module"),
  sourceRecordId: uuid("source_record_id"),
  owner: text("owner"),
  priority: priorityLevel("priority").notNull().default("medium"),
  reviewDate: date("review_date"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- tender_opportunities (Tender Ready) -------------------------------------
export const tenderOpportunities = pgTable("tender_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  title: text("title").notNull(),
  authority: text("authority"),
  reference: text("reference"),
  sector: text("sector"),
  location: text("location"),
  contractValue: bigint("contract_value", { mode: "number" })
    .notNull()
    .default(0),
  currency: text("currency").notNull().default("GBP"),
  publicationDate: date("publication_date"),
  clarificationDeadline: date("clarification_deadline"),
  submissionDeadline: date("submission_deadline"),
  contractStartDate: date("contract_start_date"),
  contractDuration: text("contract_duration"),
  procedureType: text("procedure_type").notNull().default("open"),
  status: tenderStatus("status").notNull().default("identified"),
  source: text("source"),
  summary: text("summary"),
  eligibilityNotes: text("eligibility_notes"),
  owner: text("owner"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const activityType = pgEnum("activity_type", [
  "obligation",
  "filing",
  "review",
  "policy",
  "contract",
  "risk",
  "decision",
  "report",
  "system",
  "training",
  "meeting",
]);
export const activityStatus = pgEnum("activity_status", [
  "open",
  "in_progress",
  "overdue",
  "upcoming",
  "completed",
  "info",
]);

// --- activities (audit trail / activity feed) --------------------------------
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  actorUserId: uuid("actor_user_id"),
  activityType: activityType("activity_type").notNull(),
  module: text("module").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: activityStatus("status").notNull().default("open"),
  priority: priorityLevel("priority").notNull().default("none"),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  metadata: jsonb("metadata").notNull().default({}),
  dueAt: ts("due_at"),
  completedAt: ts("completed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- plans (billing catalogue; public read) ----------------------------------
export const plans = pgTable("plans", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  priceMinor: bigint("price_minor", { mode: "number" }),
  currency: text("currency").notNull().default("GBP"),
  seatLimit: integer("seat_limit"),
  isSellable: boolean("is_sellable").notNull().default(false),
  stripePriceId: text("stripe_price_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// --- subscriptions (one canonical row per workspace) -------------------------
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().unique(),
  planKey: text("plan_key").notNull(),
  status: text("status").notNull().default("trialing"),
  seatsAllowed: integer("seats_allowed").notNull().default(1),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: ts("current_period_end"),
  cancelAt: ts("cancel_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- billing_events (Stripe webhook idempotency + audit) ---------------------
export const billingEvents = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id"),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: ts("processed_at").notNull().defaultNow(),
});

// --- evidence_library_items (proof/evidence records) -------------------------
export const evidenceLibraryItems = pgTable("evidence_library_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sourceModule: text("source_module"),
  sourceRecordId: uuid("source_record_id"),
  status: text("status").notNull().default("current"),
  reviewDate: date("review_date"),
  fileName: text("file_name"),
  notes: text("notes"),
  owner: text("owner"),
  issueDate: date("issue_date"),
  accessLevel: text("access_level").notNull().default("workspace"), // workspace | restricted
  objectKey: text("object_key"),
  mimeType: text("mime_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  originalName: text("original_name"),
  uploadedBy: uuid("uploaded_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const jovaSender = pgEnum("jova_sender", ["user", "jova"]);

// --- conversations (Jova chat threads) ---------------------------------------
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  title: text("title").notNull().default("New conversation"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- messages (Jova chat turns, with provenance) -----------------------------
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  conversationId: uuid("conversation_id").notNull(),
  sender: jovaSender("sender").notNull(),
  content: text("content").notNull(),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  suggestedAction: jsonb("suggested_action"),
  structured: jsonb("structured"),
  rulesVersion: text("rules_version"),
  aiProvider: text("ai_provider"),
  modelVersion: text("model_version"),
  safetyDecision: text("safety_decision"),
  userFeedback: text("user_feedback"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// --- jova_sources (per-message citations) ------------------------------------
export const jovaSources = pgTable("jova_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  messageId: uuid("message_id").notNull(),
  sourceModule: text("source_module").notNull(),
  sourceRecordId: uuid("source_record_id"),
  note: text("note"),
});

// --- notifications (in-app reminders/alerts) ---------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  kind: text("kind").notNull(), // priority | report | insight | risk
  title: text("title").notNull(),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  read: boolean("read").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// --- companies_house_cache (public CH data, cached per workspace) ------------
// Reads are RLS-scoped to members; writes are service-role only (the refresh
// job), so the service layer writes via adminDb scoped by workspace_id.
export const companiesHouseCache = pgTable("companies_house_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  companyNumber: text("company_number").notNull(),
  resource: text("resource").notNull(), // profile | officers | filing_history
  data: jsonb("data").notNull(),
  fetchedAt: ts("fetched_at").notNull().defaultNow(),
});

export const reportType = pgEnum("report_type", [
  "executive_summary",
  "business_confidence",
  "compliance_overview",
  "risk_summary",
  "monthly_activity",
  "training_summary",
]);

// --- reports (saved report snapshots) ----------------------------------------
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  reportType: reportType("report_type").notNull(),
  title: text("title").notNull(),
  reportingPeriod: text("reporting_period"),
  status: text("status").notNull().default("draft"),
  summary: text("summary"),
  sections: jsonb("sections").notNull().default([]),
  metrics: jsonb("metrics").notNull().default([]),
  findings: text("findings").array().notNull().default([]),
  priorityActions: text("priority_actions").array().notNull().default([]),
  sourceModules: text("source_modules").array().notNull().default([]),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- academy_assignments (learner records; course_id → code catalogue) -------
export const academyAssignments = pgTable("academy_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  learnerId: text("learner_id").notNull(),
  learnerName: text("learner_name"),
  courseId: text("course_id").notNull(),
  assignedBy: text("assigned_by"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("assigned"),
  requiredByCompany: boolean("required_by_company").notNull().default(false),
  legallyRequired: boolean("legally_required").notNull().default(false),
  externalCompletionNote: text("external_completion_note"),
  reason: text("reason"),
  completedAt: ts("completed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- academy_progress --------------------------------------------------------
export const academyProgress = pgTable("academy_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  learnerId: text("learner_id").notNull(),
  courseId: text("course_id").notNull(),
  lessonsCompleted: text("lessons_completed").array().notNull().default([]),
  startedAt: ts("started_at").notNull().defaultNow(),
  lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
  completedAt: ts("completed_at"),
  timeMinutes: integer("time_minutes").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- academy_certificates ----------------------------------------------------
export const academyCertificates = pgTable("academy_certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  reference: text("reference").notNull(),
  learnerId: text("learner_id").notNull(),
  learnerName: text("learner_name"),
  courseId: text("course_id").notNull(),
  courseTitle: text("course_title"),
  completedAt: ts("completed_at").notNull().defaultNow(),
  quizScore: integer("quiz_score").notNull().default(0),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Inferred row types for convenience.
export type Workspace = typeof workspaces.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type ComplianceObligation = typeof complianceObligations.$inferSelect;
export type NewComplianceObligation = typeof complianceObligations.$inferInsert;
export type Risk = typeof risks.$inferSelect;
export type NewRisk = typeof risks.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type ProcessingActivity = typeof processingActivities.$inferSelect;
export type NewProcessingActivity = typeof processingActivities.$inferInsert;
export type GovernanceRecord = typeof governanceRecords.$inferSelect;
export type NewGovernanceRecord = typeof governanceRecords.$inferInsert;
export type DueDiligenceItem = typeof dueDiligenceItems.$inferSelect;
export type NewDueDiligenceItem = typeof dueDiligenceItems.$inferInsert;
export type TenderOpportunity = typeof tenderOpportunities.$inferSelect;
export type NewTenderOpportunity = typeof tenderOpportunities.$inferInsert;
