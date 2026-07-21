import { z } from "zod";

// Shared validation for the GDPR record of processing activities (ROPA).

export const lawfulBasisEnum = z.enum([
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
]);

export const processingStatusEnum = z.enum(["active", "archived"]);

const isoDate = z.string().date();

export const createProcessingActivitySchema = z.object({
  activityName: z.string().trim().min(1).max(200),
  businessPurpose: z.string().nullish(),
  dataSubjects: z.string().nullish(),
  personalDataCategories: z.string().nullish(),
  specialCategoryData: z.boolean().default(false),
  lawfulBasis: lawfulBasisEnum.nullish(),
  recipients: z.string().nullish(),
  processors: z.string().nullish(),
  internationalTransfers: z.boolean().default(false),
  retentionPeriod: z.string().trim().max(200).nullish(),
  securityMeasures: z.string().nullish(),
  owner: z.string().trim().max(200).nullish(),
  reviewDate: isoDate.nullish(),
});

export const updateProcessingActivitySchema = createProcessingActivitySchema
  .partial()
  .extend({ status: processingStatusEnum.optional() });

export type CreateProcessingActivityInput = z.infer<
  typeof createProcessingActivitySchema
>;
export type UpdateProcessingActivityInput = z.infer<
  typeof updateProcessingActivitySchema
>;
