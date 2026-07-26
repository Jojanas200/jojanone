import { z } from "zod";

// Shared validation for the GDPR operational sub-registers (DSARs, breaches,
// DPIAs). Enum values mirror the Postgres types in migration 0003.

const isoDate = z.string().date(); // YYYY-MM-DD
const riskBand = z.enum(["low", "medium", "high"]);

// --- Data subject requests (DSARs) ------------------------------------------
export const dataRequestTypeEnum = z.enum([
  "subject_access",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability",
]);
export const dataRequestStatusEnum = z.enum([
  "open",
  "in_progress",
  "completed",
  "closed",
]);

export const createDataRequestSchema = z.object({
  requestType: dataRequestTypeEnum,
  requesterReference: z.string().trim().max(200).nullish(),
  receivedDate: isoDate,
  // Optional on input; the service defaults it to received + 1 month.
  dueDate: isoDate.optional(),
  identityVerified: z.boolean().default(false),
  status: dataRequestStatusEnum.default("open"),
  assignedOwner: z.string().trim().max(200).nullish(),
  notes: z.string().nullish(),
});
// dueDate stays non-null (statutory clock); partial() keeps it optional.
export const updateDataRequestSchema = createDataRequestSchema.partial();

// --- Data breaches ----------------------------------------------------------
export const breachStatusEnum = z.enum(["open", "contained", "closed"]);

export const createDataBreachSchema = z.object({
  title: z.string().trim().min(1).max(200),
  discoveredDate: isoDate.optional(), // stored as discovered_at (timestamptz)
  occurredDate: isoDate.nullish(),
  description: z.string().nullish(),
  dataInvolved: z.string().nullish(),
  affectedPeopleEstimate: z.number().int().min(0).default(0),
  riskLevel: riskBand.default("low"),
  containmentActions: z.string().nullish(),
  icoNotificationAssessment: z.string().nullish(),
  individualNotificationAssessment: z.string().nullish(),
  status: breachStatusEnum.default("open"),
  owner: z.string().trim().max(200).nullish(),
  professionalSupportRequired: z.boolean().default(false),
});
export const updateDataBreachSchema = createDataBreachSchema.partial();

// --- DPIAs ------------------------------------------------------------------
export const dpiaStatusEnum = z.enum(["draft", "approved", "review_due"]);

export const createDpiaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  project: z.string().trim().max(200).nullish(),
  processingSummary: z.string().nullish(),
  necessity: z.string().nullish(),
  risks: z.string().nullish(),
  controls: z.string().nullish(),
  residualRisk: riskBand.default("low"),
  status: dpiaStatusEnum.default("draft"),
  owner: z.string().trim().max(200).nullish(),
  reviewDate: isoDate.nullish(),
});
export const updateDpiaSchema = createDpiaSchema.partial();

// --- Privacy notices --------------------------------------------------------
export const privacyNoticeStatusEnum = z.enum(["draft", "published"]);

export const createPrivacyNoticeSchema = z.object({
  version: z.string().trim().max(20).default("1.0"),
  status: privacyNoticeStatusEnum.default("draft"),
  organisation: z.string().trim().max(200).nullish(),
  contactDetails: z.string().nullish(),
  dataCollected: z.string().nullish(),
  purposes: z.string().nullish(),
  lawfulBases: z.array(z.string()).default([]),
  sharing: z.string().nullish(),
  internationalTransfers: z.string().nullish(),
  retention: z.string().nullish(),
  rights: z.string().nullish(),
  complaints: z.string().nullish(),
  reviewDate: isoDate.nullish(),
});
export const updatePrivacyNoticeSchema = createPrivacyNoticeSchema.partial();

// --- GDPR readiness assessment (checklist-scored) ---------------------------
// Shared question set so the score, gaps and recommendations are derived
// identically on both sides. Each unmet item yields a plain-language gap and a
// prioritised recommendation.
export const GDPR_CHECKLIST = [
  {
    key: "ropa",
    label: "We maintain a record of processing activities (ROPA)",
    gap: "Record of processing activities (ROPA) not maintained",
    recommendation: "Create and maintain a record of processing activities",
    priority: "medium",
  },
  {
    key: "purposes",
    label: "We have documented our processing purposes",
    gap: "Processing purposes not documented",
    recommendation: "Document the purpose behind each processing activity",
    priority: "medium",
  },
  {
    key: "lawful_basis",
    label: "We have identified a lawful basis for each activity",
    gap: "Lawful basis not identified for each activity",
    recommendation: "Identify and document a lawful basis for each activity",
    priority: "high",
  },
  {
    key: "special_category",
    label:
      "Where we process special category data, we have an Article 9 condition",
    gap: "No Article 9 condition for special category data",
    recommendation:
      "Identify an Article 9 condition for any special category data",
    priority: "high",
  },
  {
    key: "privacy_notice",
    label: "We have a current privacy notice",
    gap: "Privacy notice not current",
    recommendation: "Update public privacy notice",
    priority: "high",
  },
  {
    key: "dsar_process",
    label: "We have a process for handling data subject requests",
    gap: "No process for data subject requests",
    recommendation: "Adopt a data subject request (DSAR) procedure",
    priority: "medium",
  },
  {
    key: "breach_process",
    label: "We have a 72-hour breach response plan",
    gap: "No 72-hour breach response plan",
    recommendation: "Put a 72-hour breach response plan in place",
    priority: "high",
  },
  {
    key: "retention",
    label: "We have data retention schedules",
    gap: "Retention schedule not documented",
    recommendation: "Document a data retention schedule",
    priority: "medium",
  },
  {
    key: "processors",
    label: "We have data processing agreements with our processors",
    gap: "No data processing agreements with processors",
    recommendation: "Put processor agreements (DPAs) in place",
    priority: "medium",
  },
  {
    key: "international_transfers",
    label: "We have assessed any international data transfers",
    gap: "International data transfers not assessed",
    recommendation:
      "Assess international data transfers and put safeguards in place",
    priority: "medium",
  },
  {
    key: "security",
    label: "We have appropriate technical security measures",
    gap: "Technical security measures not in place",
    recommendation:
      "Implement appropriate technical and organisational security measures",
    priority: "high",
  },
  {
    key: "dpia_process",
    label: "We have a DPIA screening process for high-risk processing",
    gap: "No DPIA screening process",
    recommendation: "Adopt a DPIA screening process for high-risk processing",
    priority: "medium",
  },
  {
    key: "childrens_data",
    label: "We have considered children's data (if we process any)",
    gap: "Children's data not considered",
    recommendation:
      "Assess whether you process children's data and apply extra protections",
    priority: "medium",
  },
  {
    key: "training",
    label: "Staff receive data protection training",
    gap: "Staff not trained on data protection",
    recommendation: "Provide staff with data protection training",
    priority: "medium",
  },
  {
    key: "accountability",
    label: "We have assigned data protection responsibility",
    gap: "No assigned data protection responsibility",
    recommendation: "Assign clear data protection responsibility",
    priority: "medium",
  },
] as const;

export type GdprRecommendation = { label: string; priority: "high" | "medium" };

// Tri-state answers from the health-check wizard. Only an explicit "yes" (or a
// legacy boolean true) counts as met; "no" and "unsure" both leave a gap.
export const gdprAnswerEnum = z.enum(["yes", "no", "unsure"]);
export type GdprAnswer = z.infer<typeof gdprAnswerEnum>;

const isMet = (v: unknown) => v === true || v === "yes";

// Single source of truth: score (% of met items), plain-language gaps, and
// prioritised recommendations for the unmet items. Deterministic from answers.
export function deriveGdprFindings(answers: Record<string, unknown>) {
  const unmet = GDPR_CHECKLIST.filter((q) => !isMet(answers[q.key]));
  const met = GDPR_CHECKLIST.length - unmet.length;
  const score = Math.round((met / GDPR_CHECKLIST.length) * 100);
  const gaps = unmet.map((q) => q.gap);
  const recommendations: GdprRecommendation[] = unmet.map((q) => ({
    label: q.recommendation,
    priority: q.priority,
  }));
  return { score, gaps, recommendations };
}

export const saveGdprAssessmentSchema = z.object({
  answers: z.record(z.string(), gdprAnswerEnum),
});
export type SaveGdprAssessmentInput = z.infer<typeof saveGdprAssessmentSchema>;
export type CreatePrivacyNoticeInput = z.infer<
  typeof createPrivacyNoticeSchema
>;
export type UpdatePrivacyNoticeInput = z.infer<
  typeof updatePrivacyNoticeSchema
>;

export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>;
export type UpdateDataRequestInput = z.infer<typeof updateDataRequestSchema>;
export type CreateDataBreachInput = z.infer<typeof createDataBreachSchema>;
export type UpdateDataBreachInput = z.infer<typeof updateDataBreachSchema>;
export type CreateDpiaInput = z.infer<typeof createDpiaSchema>;
export type UpdateDpiaInput = z.infer<typeof updateDpiaSchema>;
