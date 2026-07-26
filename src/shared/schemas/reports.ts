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
  status: z.enum(["draft", "final"]).optional(),
  summary: z.string().trim().max(5000).nullish(),
  sections: z
    .array(z.object({ title: z.string().max(200), body: z.string().max(5000) }))
    .max(40)
    .optional(),
  metrics: z.array(z.unknown()).max(100).optional(),
  findings: z.array(z.string().max(500)).max(100).optional(),
  priorityActions: z.array(z.string().max(500)).max(100).optional(),
  sourceModules: z.array(z.string().max(60)).max(30).optional(),
});

export type SaveReportInput = z.infer<typeof saveReportSchema>;

// Generate a report of a given type from live data over a period label.
export const generateReportSchema = z.object({
  reportType: reportTypeEnum,
  period: z.string().trim().min(1).max(120),
  // Which sections to keep in the composed report (all on by default).
  include: z
    .object({
      summary: z.boolean().default(true),
      metrics: z.boolean().default(true),
      findings: z.boolean().default(true),
      actions: z.boolean().default(true),
    })
    .default({ summary: true, metrics: true, findings: true, actions: true }),
});

export const renameReportSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
