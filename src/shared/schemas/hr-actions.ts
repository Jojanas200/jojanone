import { z } from "zod";

// Shared validation for HR actions (people tasks).

export const hrActionTypeEnum = z.enum([
  "right_to_work",
  "probation_review",
  "contract_issue",
  "training",
  "policy_ack",
  "performance_review",
  "return_to_work",
  "welfare",
  "document_renewal",
]);
export const hrActionStatusEnum = z.enum(["open", "in_progress", "completed"]);
export const priorityEnum = z.enum(["high", "medium", "low", "none"]);

const isoDate = z.string().date();

export const createHrActionSchema = z.object({
  actionType: hrActionTypeEnum,
  title: z.string().trim().min(1).max(200),
  description: z.string().nullish(),
  employeeId: z.string().uuid().nullish(),
  priority: priorityEnum.default("medium"),
  status: hrActionStatusEnum.default("open"),
  dueDate: isoDate.nullish(),
  notes: z.string().nullish(),
});
export const updateHrActionSchema = createHrActionSchema.partial();

export type CreateHrActionInput = z.infer<typeof createHrActionSchema>;
export type UpdateHrActionInput = z.infer<typeof updateHrActionSchema>;
