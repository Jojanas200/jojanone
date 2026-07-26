import { z } from "zod";

// Shared validation for tender readiness: requirements, responses and the
// bid/no-bid decision assessment.

const isoDate = z.string().date();

// --- Requirements -----------------------------------------------------------
export const requirementStatusEnum = z.enum([
  "not_started",
  "in_progress",
  "met",
  "not_met",
]);
export const createTenderRequirementSchema = z.object({
  opportunityId: z.string().uuid().nullish(),
  requirementType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  description: z.string().nullish(),
  mandatory: z.boolean().default(false),
  weighting: z.number().int().min(0).max(100).default(0),
  status: requirementStatusEnum.default("not_started"),
  owner: z.string().trim().max(200).nullish(),
  dueDate: isoDate.nullish(),
  evidenceReference: z.string().nullish(),
  sourceSection: z.string().trim().max(200).nullish(),
  notes: z.string().nullish(),
});
export const updateTenderRequirementSchema =
  createTenderRequirementSchema.partial();

// --- Responses --------------------------------------------------------------
export const responseStatusEnum = z.enum(["draft", "in_review", "final"]);
export const createTenderResponseSchema = z.object({
  opportunityId: z.string().uuid().nullish(),
  version: z.number().int().min(1).default(1),
  sectionTitle: z.string().trim().max(200).nullish(),
  question: z.string().nullish(),
  wordLimit: z.number().int().min(0).default(0),
  responseText: z.string().nullish(),
  status: responseStatusEnum.default("draft"),
  reviewNotes: z.string().nullish(),
  owner: z.string().trim().max(200).nullish(),
});
export const updateTenderResponseSchema = createTenderResponseSchema.partial();

// --- Bid assessment (checklist by dimension -> bid/no-bid) ------------------
export const TENDER_DIMENSIONS = [
  "strategic_fit",
  "eligibility",
  "capacity",
  "evidence",
  "commercial",
  "delivery_risk",
] as const;
export type TenderDimension = (typeof TENDER_DIMENSIONS)[number];

export const TENDER_BID_CHECKLIST: {
  key: string;
  label: string;
  dim: TenderDimension;
}[] = [
  {
    key: "aligned",
    label: "The work aligns with our strategy",
    dim: "strategic_fit",
  },
  {
    key: "reference_client",
    label: "It would be a valuable reference client",
    dim: "strategic_fit",
  },
  {
    key: "eligible",
    label: "We meet all eligibility criteria",
    dim: "eligibility",
  },
  {
    key: "accreditations",
    label: "We hold the required accreditations",
    dim: "eligibility",
  },
  {
    key: "capacity_deliver",
    label: "We have capacity to deliver",
    dim: "capacity",
  },
  {
    key: "team_available",
    label: "The right team is available",
    dim: "capacity",
  },
  {
    key: "case_studies",
    label: "We have relevant case studies",
    dim: "evidence",
  },
  {
    key: "policies_ready",
    label: "Required policies are in place",
    dim: "evidence",
  },
  {
    key: "price_viable",
    label: "We can price this profitably",
    dim: "commercial",
  },
  {
    key: "payment_terms",
    label: "Payment terms are acceptable",
    dim: "commercial",
  },
  {
    key: "risk_understood",
    label: "Delivery risks are understood",
    dim: "delivery_risk",
  },
  {
    key: "risk_mitigated",
    label: "We can mitigate the key risks",
    dim: "delivery_risk",
  },
];

export const saveBidAssessmentSchema = z.object({
  answers: z.record(z.string(), z.boolean()),
  decision: z.enum(["pending", "bid", "no_bid"]).optional(),
  decisionReason: z.string().nullish(),
});
export type SaveBidAssessmentInput = z.infer<typeof saveBidAssessmentSchema>;

export type CreateTenderRequirementInput = z.infer<
  typeof createTenderRequirementSchema
>;
export type UpdateTenderRequirementInput = z.infer<
  typeof updateTenderRequirementSchema
>;
export type CreateTenderResponseInput = z.infer<
  typeof createTenderResponseSchema
>;
export type UpdateTenderResponseInput = z.infer<
  typeof updateTenderResponseSchema
>;
