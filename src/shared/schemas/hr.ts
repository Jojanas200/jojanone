import { z } from "zod";

// Shared validation for the HR employees register. Enum values mirror the
// Postgres enums / status columns in supabase/migrations/0002_business.sql.

export const employmentTypeEnum = z.enum([
  "employee",
  "contractor",
  "consultant",
  "intern",
]);
export const employmentStatusEnum = z.enum([
  "active",
  "probation",
  "notice",
  "archived",
]);
export const rightToWorkEnum = z.enum([
  "verified",
  "outstanding",
  "expired",
  "not_required",
]);
export const trainingEnum = z.enum(["complete", "outstanding", "overdue"]);
export const contractStatusEnum = z.enum(["signed", "pending", "missing"]);
export const ackEnum = z.enum(["complete", "outstanding"]);
export const riskBandEnum = z.enum(["low", "medium", "high"]);

const isoDate = z.string().date();

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().max(200).nullish(),
  department: z.string().trim().max(200).nullish(),
  employmentType: employmentTypeEnum.default("employee"),
  employmentStatus: employmentStatusEnum.default("active"),
  startDate: isoDate.nullish(),
  contractStatus: contractStatusEnum.default("missing"),
  rightToWorkStatus: rightToWorkEnum.default("outstanding"),
  rightToWorkExpiry: isoDate.nullish(),
  policyAcknowledgementStatus: ackEnum.default("outstanding"),
  trainingStatus: trainingEnum.default("outstanding"),
  nextReviewDate: isoDate.nullish(),
  riskLevel: riskBandEnum.default("low"),
  notes: z.string().nullish(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
