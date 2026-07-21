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
  submissionDeadline: isoDate.nullish(),
  procedureType: procedureEnum.default("open"),
  status: tenderStatusEnum.default("identified"),
  summary: z.string().nullish(),
  owner: z.string().trim().max(200).nullish(),
});

export const updateTenderOpportunitySchema =
  createTenderOpportunitySchema.partial();

export const setTenderStatusSchema = z.object({ status: tenderStatusEnum });

export type CreateTenderOpportunityInput = z.infer<
  typeof createTenderOpportunitySchema
>;
export type UpdateTenderOpportunityInput = z.infer<
  typeof updateTenderOpportunitySchema
>;
