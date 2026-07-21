import { z } from "zod";

// Academy - learner assignments over the code course catalogue.

export const assignmentStatusEnum = z.enum([
  "assigned",
  "in_progress",
  "completed",
  "overdue",
]);

const isoDate = z.string().date();

export const createAssignmentSchema = z.object({
  courseId: z.string().trim().min(1).max(120),
  learnerId: z.string().trim().min(1).max(120).default("owner"),
  learnerName: z.string().trim().max(200).nullish(),
  dueDate: isoDate.nullish(),
  requiredByCompany: z.boolean().default(false),
  legallyRequired: z.boolean().default(false),
  reason: z.string().trim().max(500).nullish(),
});

export const updateAssignmentSchema = z.object({
  status: assignmentStatusEnum.optional(),
  dueDate: isoDate.nullish(),
  learnerName: z.string().trim().max(200).nullish(),
  requiredByCompany: z.boolean().optional(),
  legallyRequired: z.boolean().optional(),
  reason: z.string().trim().max(500).nullish(),
  externalCompletionNote: z.string().trim().max(500).nullish(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
