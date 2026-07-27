import { z } from "zod";

// Shared validation for the business entities (key parties) register.

export const entityTypeEnum = z.enum([
  "customer",
  "supplier",
  "director",
  "employee",
  "contractor",
  "tech_lead",
  "adviser",
  "regulator",
  "partner",
  "insurer",
  "bank",
]);
export const entityStatusEnum = z.enum([
  "active",
  "review_due",
  "at_risk",
  "archived",
  "missing_info",
]);
export const importanceEnum = z.enum(["high", "medium", "low", "none"]);
export const riskBandEnum = z.enum(["low", "medium", "high"]);

const isoDate = z.string().date();

export const createEntitySchema = z.object({
  entityType: entityTypeEnum,
  name: z.string().trim().min(1).max(200),
  relationship: z.string().trim().max(200).nullish(),
  status: entityStatusEnum.default("active"),
  importance: importanceEnum.default("medium"),
  riskLevel: riskBandEnum.default("low"),
  contactName: z.string().trim().max(200).nullish(),
  email: z.string().trim().max(200).nullish(),
  startDate: isoDate.nullish(),
  reviewDate: isoDate.nullish(),
  notes: z.string().nullish(),
});
export const updateEntitySchema = createEntitySchema.partial();

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
