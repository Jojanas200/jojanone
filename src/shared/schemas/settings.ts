import { z } from "zod";

// Settings - business profile + workspace preferences.

const isoDate = z.string().date();

export const updateBusinessProfileSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  companyNumber: z.string().trim().max(20).nullish(),
  businessType: z.string().trim().max(80).nullish(),
  industry: z.string().trim().max(120).nullish(),
  incorporationDate: isoDate.nullish(),
  registeredAddress: z.string().trim().max(500).nullish(),
  tradingAddress: z.string().trim().max(500).nullish(),
  financialYearEnd: z.string().trim().max(20).nullish(),
  employeeCount: z.number().int().min(0).max(1_000_000).optional(),
  contractorCount: z.number().int().min(0).max(1_000_000).optional(),
  customerCount: z.number().int().min(0).max(100_000_000).optional(),
  supplierCount: z.number().int().min(0).max(1_000_000).optional(),
  annualRevenueBand: z.string().trim().max(60).nullish(),
  vatRegistered: z.boolean().optional(),
  employerRegistered: z.boolean().optional(),
  processesPersonalData: z.boolean().optional(),
  tradesInternationally: z.boolean().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  brandColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour")
    .nullish(),
  timeZone: z.string().trim().max(60).optional(),
});

export type UpdateBusinessProfileInput = z.infer<
  typeof updateBusinessProfileSchema
>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
