import { z } from "zod";

// Shared validation for Governance records (board meetings, resolutions,
// decisions, minutes). Enum values mirror supabase/migrations/0003.

export const governanceRecordTypeEnum = z.enum([
  "board_meeting",
  "written_resolution",
  "director_decision",
  "shareholder_decision",
  "meeting_minutes",
  "governance_review",
]);

export const governanceStatusEnum = z.enum([
  "draft",
  "pending",
  "approved",
  "deferred",
  "rejected",
  "completed",
]);

const isoDate = z.string().date();

export const createGovernanceRecordSchema = z.object({
  recordType: governanceRecordTypeEnum,
  title: z.string().trim().min(1).max(200),
  description: z.string().nullish(),
  status: governanceStatusEnum.optional(),
  meetingDate: isoDate.nullish(),
  decisionDate: isoDate.nullish(),
  reviewDate: isoDate.nullish(),
  owner: z.string().trim().max(200).nullish(),
  participants: z.string().nullish(),
  // Structured director-decision fields (Companies Act s.172-style records).
  background: z.string().nullish(),
  optionsConsidered: z.string().nullish(),
  risksConsidered: z.string().nullish(),
  decision: z.string().nullish(),
  decisionMaker: z.string().trim().max(200).nullish(),
  actions: z.string().nullish(),
  notes: z.string().nullish(),
});

export const updateGovernanceRecordSchema =
  createGovernanceRecordSchema.partial();

export const setGovernanceStatusSchema = z.object({
  status: governanceStatusEnum,
});

export type CreateGovernanceRecordInput = z.infer<
  typeof createGovernanceRecordSchema
>;
export type UpdateGovernanceRecordInput = z.infer<
  typeof updateGovernanceRecordSchema
>;
