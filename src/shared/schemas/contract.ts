import { z } from "zod";

// Shared client<->server validation for Contracts. Enum values mirror the
// Postgres enums in supabase/migrations/0002_business.sql.

export const contractTypeEnum = z.enum([
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

export const contractStatusEnum = z.enum([
  "active",
  "draft",
  "expired",
  "archived",
  "pending_signature",
]);

export const riskBandEnum = z.enum(["low", "medium", "high"]);

const isoDate = z.string().date(); // YYYY-MM-DD

export const createContractSchema = z.object({
  contractType: contractTypeEnum,
  title: z.string().trim().min(1).max(200),
  counterparty: z.string().trim().max(200).default(""),
  status: contractStatusEnum.default("draft"),
  currency: z.string().trim().length(3).default("GBP"),
  valueMinor: z.number().int().min(0).default(0),
  startDate: isoDate.nullish(),
  endDate: isoDate.nullish(),
  renewalDate: isoDate.nullish(),
  noticePeriodDays: z.number().int().min(0).nullish(),
  owner: z.string().trim().max(200).nullish(),
  riskLevel: riskBandEnum.default("low"),
  keyTerms: z.string().nullish(),
  obligations: z.string().nullish(),
  nextAction: z.string().nullish(),
  nextActionDate: isoDate.nullish(),
  notes: z.string().nullish(),
  entityId: z.string().uuid().nullish(),
});

export const updateContractSchema = createContractSchema.partial();

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
