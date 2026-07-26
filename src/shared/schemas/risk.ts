import { z } from "zod";

// Shared validation for the Risk register. Scores/ratings are computed
// server-side from likelihood × impact - not accepted from the client.

export const riskCategoryEnum = z.enum([
  "compliance",
  "contracts",
  "data_protection",
  "cyber",
  "people",
  "financial",
  "operational",
  "supplier",
  "strategic",
]);

export const riskResponseEnum = z.enum([
  "avoid",
  "reduce",
  "transfer",
  "accept",
  "monitor",
]);
export const controlEffectivenessEnum = z.enum([
  "strong",
  "adequate",
  "weak",
  "none",
]);
export const riskStatusEnum = z.enum(["open", "accepted", "closed"]);

const score = z.coerce.number().int().min(1).max(5);

export const createRiskSchema = z.object({
  riskTitle: z.string().trim().min(1).max(200),
  riskCategory: riskCategoryEnum,
  description: z.string().nullish(),
  cause: z.string().nullish(),
  consequence: z.string().nullish(),
  likelihood: score,
  impact: score,
  controls: z.string().nullish(),
  controlEffectiveness: controlEffectivenessEnum.default("none"),
  residualLikelihood: score,
  residualImpact: score,
  riskOwner: z.string().trim().max(200).nullish(),
  response: riskResponseEnum.default("monitor"),
  reviewDate: z.string().date().nullish(),
});

export const updateRiskSchema = createRiskSchema.partial();

// Lifecycle transitions carry a reason.
export const setRiskStatusSchema = z.object({
  status: riskStatusEnum,
  reason: z.string().trim().max(500).nullish(),
});

// Mitigation/treatment actions embedded on the risk record.
export type RiskMitigation = {
  id: string;
  label: string;
  dueDate: string | null;
  completedAt: string | null;
};

export const addRiskMitigationSchema = z.object({
  label: z.string().trim().min(1).max(300),
  dueDate: z.string().date().nullish(),
});

export const setRiskMitigationSchema = z.object({
  mitigationId: z.string().uuid(),
  done: z.boolean(),
});

export type AddRiskMitigationInput = z.infer<typeof addRiskMitigationSchema>;
export type SetRiskMitigationInput = z.infer<typeof setRiskMitigationSchema>;
export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
