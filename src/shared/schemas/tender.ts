import { z } from "zod";

// Tender Ready - tender/procurement opportunities.

export const tenderStatusEnum = z.enum([
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

export const procedureEnum = z.enum([
  "open",
  "restricted",
  "framework",
  "direct_award",
  "quotation",
  "other",
]);

const isoDate = z.string().date();

export const createTenderOpportunitySchema = z.object({
  title: z.string().trim().min(1).max(200),
  authority: z.string().trim().max(200).nullish(),
  reference: z.string().trim().max(120).nullish(),
  sector: z.string().trim().max(120).nullish(),
  location: z.string().trim().max(120).nullish(),
  contractValue: z.number().int().min(0).default(0),
  currency: z.string().trim().length(3).default("GBP"),
  publicationDate: isoDate.nullish(),
  clarificationDeadline: isoDate.nullish(),
  submissionDeadline: isoDate.nullish(),
  contractStartDate: isoDate.nullish(),
  contractDuration: z.string().trim().max(120).nullish(),
  procedureType: procedureEnum.default("open"),
  status: tenderStatusEnum.default("identified"),
  source: z.string().trim().max(200).nullish(),
  summary: z.string().nullish(),
  eligibilityNotes: z.string().nullish(),
  owner: z.string().trim().max(200).nullish(),
});

export const updateTenderOpportunitySchema =
  createTenderOpportunitySchema.partial();

export const setTenderStatusSchema = z.object({ status: tenderStatusEnum });

// Submission checklist (embedded on the opportunity).
export type TenderChecklistItem = {
  id: string;
  label: string;
  mandatory: boolean;
  done: boolean;
};
export const addChecklistItemSchema = z.object({
  label: z.string().trim().min(1).max(300),
  mandatory: z.boolean().default(true),
});
export const setChecklistItemSchema = z.object({
  itemId: z.string().uuid(),
  done: z.boolean(),
});
export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>;

export type CreateTenderOpportunityInput = z.infer<
  typeof createTenderOpportunitySchema
>;
export type UpdateTenderOpportunityInput = z.infer<
  typeof updateTenderOpportunitySchema
>;
