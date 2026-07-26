import { z } from "zod";

// Shared validation for Compliance obligations. Enum values mirror the Postgres
// enums in supabase/migrations/0003_compliance_governance.sql.

export const obligationCategoryEnum = z.enum([
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

export const obligationStatusEnum = z.enum([
  "action_required",
  "in_progress",
  "completed",
  "overdue",
  "upcoming",
  "not_applicable",
]);

export const priorityEnum = z.enum(["high", "medium", "low"]);
export const recurrenceEnum = z.enum([
  "none",
  "annual",
  "quarterly",
  "monthly",
  "weekly",
]);

const isoDate = z.string().date();

export const createObligationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: obligationCategoryEnum,
  regulator: z.string().trim().max(200).nullish(),
  jurisdiction: z.string().trim().max(200).nullish(),
  description: z.string().nullish(),
  plainLanguageExplanation: z.string().nullish(),
  reasonApplies: z.string().nullish(),
  priority: priorityEnum.default("medium"),
  status: obligationStatusEnum.default("upcoming"),
  dueDate: isoDate.nullish(),
  recurrence: recurrenceEnum.default("none"),
  requiredAction: z.string().nullish(),
  owner: z.string().trim().max(200).nullish(),
  professionalSupportRequired: z.boolean().default(false),
  notes: z.string().nullish(),
});

export const applicabilityEnum = z.enum([
  "applicable",
  "not_applicable",
  "unclear",
]);

export const updateObligationSchema = createObligationSchema.partial().extend({
  applicabilityStatus: applicabilityEnum.optional(),
  naReason: z.string().nullish(),
});

// Focused schema for the common "advance the lifecycle" action.
export const setObligationStatusSchema = z.object({
  status: obligationStatusEnum,
});

export type CreateObligationInput = z.infer<typeof createObligationSchema>;
export type UpdateObligationInput = z.infer<typeof updateObligationSchema>;
