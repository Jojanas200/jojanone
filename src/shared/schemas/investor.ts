import { z } from "zod";

// Investor Ready - due-diligence checklist items.

export const ddCategoryEnum = z.enum([
  "corporate",
  "financial",
  "legal",
  "compliance",
  "commercial",
  "people",
  "data_room",
]);

export const ddStatusEnum = z.enum([
  "missing",
  "in_progress",
  "ready",
  "needs_review",
  "not_applicable",
]);

export const ddPriorityEnum = z.enum(["high", "medium", "low"]);

const isoDate = z.string().date();

export const createDueDiligenceItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: ddCategoryEnum,
  description: z.string().nullish(),
  required: z.boolean().default(true),
  status: ddStatusEnum.default("missing"),
  owner: z.string().trim().max(200).nullish(),
  priority: ddPriorityEnum.default("medium"),
  evidenceReference: z.string().trim().max(300).nullish(),
  notes: z.string().nullish(),
  reviewDate: isoDate.nullish(),
});

export const updateDueDiligenceItemSchema =
  createDueDiligenceItemSchema.partial();

export const setDdStatusSchema = z.object({ status: ddStatusEnum });

export type CreateDueDiligenceItemInput = z.infer<
  typeof createDueDiligenceItemSchema
>;
export type UpdateDueDiligenceItemInput = z.infer<
  typeof updateDueDiligenceItemSchema
>;
