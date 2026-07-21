import { z } from "zod";

// Reports - saved report snapshots.

export const reportTypeEnum = z.enum([
  "executive_summary",
  "business_confidence",
  "compliance_overview",
  "risk_summary",
  "monthly_activity",
  "training_summary",
]);

export const saveReportSchema = z.object({
  reportType: reportTypeEnum.default("executive_summary"),
  title: z.string().trim().min(1).max(200),
  reportingPeriod: z.string().trim().max(120).nullish(),
  summary: z.string().trim().max(5000).nullish(),
  metrics: z.array(z.unknown()).max(100).optional(),
  findings: z.array(z.string().max(500)).max(100).optional(),
  priorityActions: z.array(z.string().max(500)).max(100).optional(),
  sourceModules: z.array(z.string().max(60)).max(30).optional(),
});

export type SaveReportInput = z.infer<typeof saveReportSchema>;
