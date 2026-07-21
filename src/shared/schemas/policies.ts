import { z } from "zod";

// Company policy register. The DB column `status` is text (draft|active|
// archived) and `acknowledgement_status` is text (not_started|partial|complete)
// per migration 0003.

export const policyStatusEnum = z.enum(["draft", "active", "archived"]);
export const acknowledgementStatusEnum = z.enum([
  "not_started",
  "partial",
  "complete",
]);

// Common UK small-business policy areas (free text in the DB; this is guidance).
export const POLICY_CATEGORIES = [
  "Data protection",
  "HR & employment",
  "Health & safety",
  "IT & security",
  "Finance",
  "Governance",
  "Anti-bribery",
  "Environmental",
  "Other",
] as const;

const isoDate = z.string().date();

export const createPolicySchema = z.object({
  policyName: z.string().trim().min(1).max(200),
  policyCategory: z.string().trim().max(80).nullish(),
  version: z.string().trim().max(20).optional(),
  owner: z.string().trim().max(200).nullish(),
  status: policyStatusEnum.optional(),
  approvalDate: isoDate.nullish(),
  reviewDate: isoDate.nullish(),
  acknowledgementRequired: z.boolean().optional(),
  acknowledgementStatus: acknowledgementStatusEnum.optional(),
  notes: z.string().nullish(),
});

export const updatePolicySchema = createPolicySchema.partial();

export const setPolicyStatusSchema = z.object({ status: policyStatusEnum });

// --- Per-employee acknowledgements ------------------------------------------
// Roster status is distinct from the policy-level rollup (acknowledgementStatus).
export const ackRosterStatusEnum = z.enum([
  "pending",
  "acknowledged",
  "waived",
]);

// Assign a policy to specific employees and/or every active employee.
export const assignAcknowledgementsSchema = z
  .object({
    employeeIds: z.array(z.string().uuid()).max(500).optional(),
    allActive: z.boolean().optional(),
  })
  .refine((v) => v.allActive || (v.employeeIds && v.employeeIds.length > 0), {
    message: "Select at least one employee or assign to all active staff.",
  });

export const setAcknowledgementSchema = z.object({
  status: ackRosterStatusEnum,
  notes: z.string().max(2000).nullish(),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type AssignAcknowledgementsInput = z.infer<
  typeof assignAcknowledgementsSchema
>;
export type SetAcknowledgementInput = z.infer<typeof setAcknowledgementSchema>;
