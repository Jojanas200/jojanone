import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { reports } from "../db/schema";
import { listContracts } from "./contracts";
import { listObligations } from "./compliance";
import { listRisks } from "./risk";
import { listEmployees } from "./hr";
import { listProcessingActivities } from "./gdpr";
import { listTenderOpportunities } from "./tender";
import { listDueDiligenceItems } from "./investor";
import { listAssignments } from "./academy";
import { listActivities } from "./activity";
import { getSnapshot } from "./dashboard";
import { getJovaBriefing } from "./jova";

// Reports & export. CSV exports are read-only projections of the register
// modules (RLS-scoped via the underlying list services). Report snapshots are
// persisted to the `reports` table for a saved board-pack history.

type Row = Record<string, unknown>;
interface Column {
  key: string;
  label: string;
  fmt?: (v: unknown, row: Row) => string;
}

const money = (v: unknown) =>
  typeof v === "number" ? (v / 100).toFixed(2) : "";
const yesNo = (v: unknown) => (v ? "yes" : "no");
const plain = (v: unknown) => (v === null || v === undefined ? "" : String(v));

interface DatasetConfig {
  label: string;
  load: (claims: UserClaims) => Promise<Row[]>;
  columns: Column[];
}

export const DATASETS: Record<string, DatasetConfig> = {
  contracts: {
    label: "Contracts",
    load: (c) => listContracts(c) as Promise<Row[]>,
    columns: [
      { key: "title", label: "Title" },
      { key: "contractType", label: "Type" },
      { key: "counterparty", label: "Counterparty" },
      { key: "status", label: "Status" },
      { key: "valueMinor", label: "Value (GBP)", fmt: money },
      { key: "startDate", label: "Start" },
      { key: "endDate", label: "End" },
      { key: "renewalDate", label: "Renewal" },
      { key: "riskLevel", label: "Risk" },
      { key: "owner", label: "Owner" },
    ],
  },
  compliance: {
    label: "Compliance obligations",
    load: (c) => listObligations(c) as Promise<Row[]>,
    columns: [
      { key: "title", label: "Obligation" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "dueDate", label: "Due" },
      { key: "owner", label: "Owner" },
    ],
  },
  risk: {
    label: "Risk register",
    load: (c) => listRisks(c) as Promise<Row[]>,
    columns: [
      { key: "riskTitle", label: "Risk" },
      { key: "riskCategory", label: "Category" },
      { key: "status", label: "Status" },
      { key: "inherentRating", label: "Inherent" },
      { key: "residualRating", label: "Residual" },
      { key: "response", label: "Response" },
      { key: "riskOwner", label: "Owner" },
      { key: "reviewDate", label: "Review" },
    ],
  },
  hr: {
    label: "People",
    load: (c) => listEmployees(c) as Promise<Row[]>,
    columns: [
      { key: "fullName", label: "Name" },
      { key: "jobTitle", label: "Job title" },
      { key: "employmentType", label: "Type" },
      { key: "employmentStatus", label: "Status" },
      { key: "startDate", label: "Start" },
      { key: "rightToWorkStatus", label: "Right to work" },
      { key: "trainingStatus", label: "Training" },
    ],
  },
  gdpr: {
    label: "Processing activities",
    load: (c) => listProcessingActivities(c) as Promise<Row[]>,
    columns: [
      { key: "activityName", label: "Activity" },
      { key: "lawfulBasis", label: "Lawful basis" },
      { key: "specialCategoryData", label: "Special category", fmt: yesNo },
      { key: "status", label: "Status" },
      { key: "reviewDate", label: "Review" },
      { key: "owner", label: "Owner" },
    ],
  },
  tenders: {
    label: "Tender opportunities",
    load: (c) => listTenderOpportunities(c) as Promise<Row[]>,
    columns: [
      { key: "title", label: "Opportunity" },
      { key: "authority", label: "Authority" },
      { key: "contractValue", label: "Value (GBP)", fmt: money },
      { key: "currency", label: "Currency" },
      { key: "status", label: "Status" },
      { key: "submissionDeadline", label: "Deadline" },
    ],
  },
  investor: {
    label: "Due-diligence items",
    load: (c) => listDueDiligenceItems(c) as Promise<Row[]>,
    columns: [
      { key: "title", label: "Item" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "required", label: "Required", fmt: yesNo },
      { key: "owner", label: "Owner" },
      { key: "reviewDate", label: "Review" },
    ],
  },
  academy: {
    label: "Learning",
    load: (c) => listAssignments(c) as unknown as Promise<Row[]>,
    columns: [
      { key: "courseTitle", label: "Course" },
      { key: "courseCategory", label: "Category" },
      { key: "status", label: "Status" },
      { key: "dueDate", label: "Due" },
      { key: "learnerName", label: "Learner" },
    ],
  },
  activity: {
    label: "Activity log",
    load: (c) => listActivities(c, 500) as unknown as Promise<Row[]>,
    columns: [
      { key: "createdAt", label: "When" },
      { key: "module", label: "Module" },
      { key: "title", label: "Item" },
      { key: "description", label: "Action" },
    ],
  },
};

export const DATASET_KEYS = Object.keys(DATASETS);

// RFC-4180-ish CSV escaping: quote fields containing comma, quote or newline.
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function exportCsv(
  claims: UserClaims,
  dataset: string,
): Promise<{ filename: string; csv: string } | null> {
  const cfg = DATASETS[dataset];
  if (!cfg) return null;
  const rows = await cfg.load(claims);
  const header = cfg.columns.map((c) => csvCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      cfg.columns
        .map((c) => {
          const raw = row[c.key];
          const text = c.fmt ? c.fmt(raw, row) : plain(raw);
          return csvCell(text);
        })
        .join(","),
    )
    .join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  return {
    filename: `jojan-${dataset}-${today}.csv`,
    csv: `${header}\r\n${body}\r\n`,
  };
}

// --- Saved report snapshots --------------------------------------------------

type ReportTypeValue = (typeof reports.reportType.enumValues)[number];

export interface ReportSection {
  title: string;
  body: string;
}

export interface SaveReportInput {
  reportType: ReportTypeValue;
  title: string;
  reportingPeriod?: string | null;
  status?: "draft" | "final";
  summary?: string | null;
  sections?: ReportSection[];
  metrics?: unknown[];
  findings?: string[];
  priorityActions?: string[];
  sourceModules?: string[];
}

export function saveReport(
  claims: UserClaims,
  workspaceId: string,
  input: SaveReportInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(reports)
      .values({
        workspaceId,
        createdBy: claims.sub,
        reportType: input.reportType,
        title: input.title,
        reportingPeriod: input.reportingPeriod ?? null,
        status: input.status ?? "final",
        summary: input.summary ?? null,
        sections: input.sections ?? [],
        metrics: input.metrics ?? [],
        findings: input.findings ?? [],
        priorityActions: input.priorityActions ?? [],
        sourceModules: input.sourceModules ?? [],
      })
      .returning();
    return rows[0];
  });
}

export function listReports(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: reports.id,
        reportType: reports.reportType,
        title: reports.title,
        reportingPeriod: reports.reportingPeriod,
        status: reports.status,
        summary: reports.summary,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .orderBy(desc(reports.createdAt)),
  );
}

/** The full stored report (for the preview/print page). */
export function getReport(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function renameReport(claims: UserClaims, id: string, title: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(reports)
      .set({ title, updatedAt: sql`now()` })
      .where(eq(reports.id, id))
      .returning({ id: reports.id });
    return rows.length > 0;
  });
}

/** Duplicate a report (title + " (copy)"), returns the new row or null. */
export function duplicateReport(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const src = (
      await tx.select().from(reports).where(eq(reports.id, id)).limit(1)
    )[0];
    if (!src) return null;
    const rows = await tx
      .insert(reports)
      .values({
        workspaceId: src.workspaceId,
        createdBy: claims.sub,
        reportType: src.reportType,
        title: `${src.title} (copy)`,
        reportingPeriod: src.reportingPeriod,
        status: src.status,
        summary: src.summary,
        sections: src.sections,
        metrics: src.metrics,
        findings: src.findings,
        priorityActions: src.priorityActions,
        sourceModules: src.sourceModules,
      })
      .returning();
    return rows[0];
  });
}

// --- Report catalog + generation --------------------------------------------
export interface ReportTypeMeta {
  key: ReportTypeValue;
  title: string;
  description: string;
  sources: string[];
  includes: string[];
}

export const REPORT_CATALOG: ReportTypeMeta[] = [
  {
    key: "executive_summary",
    title: "Executive Summary",
    description:
      "Board-ready overview covering position, concerns and decisions.",
    sources: ["Compliance", "Risk", "HR", "Governance", "Contracts", "GDPR"],
    includes: ["Executive summary", "Key metrics", "Priority actions"],
  },
  {
    key: "business_confidence",
    title: "Business Confidence Report",
    description:
      "Full breakdown of your Business Confidence Score and its drivers.",
    sources: ["All modules"],
    includes: ["Score", "Area breakdown", "Recommendations"],
  },
  {
    key: "compliance_overview",
    title: "Compliance Overview",
    description: "Statutory filings, obligations tracked and current position.",
    sources: ["Compliance"],
    includes: ["Filing status", "Overdue items", "Upcoming filings"],
  },
  {
    key: "risk_summary",
    title: "Risk Summary",
    description: "Active risks, severity and mitigation status.",
    sources: ["Risk"],
    includes: ["Risk register", "Severity breakdown", "Mitigations"],
  },
  {
    key: "monthly_activity",
    title: "Monthly Activity Report",
    description: "Everything that happened in your business this month.",
    sources: ["Activity log"],
    includes: ["Activity by module", "Completed items", "New priorities"],
  },
  {
    key: "training_summary",
    title: "Training and Learning Summary",
    description: "Assignments, completions and learning across Academy.",
    sources: ["Academy", "HR"],
    includes: ["Assignment status", "Completion rate", "Certificates"],
  },
];

const metric = (label: string, value: string | number) => ({
  label,
  value: String(value),
});

/**
 * Build a report of the given type from the workspace's live, RLS-scoped data.
 * Returns a SaveReportInput ready to persist. `period` is a display label.
 */
export async function composeReport(
  claims: UserClaims,
  reportType: ReportTypeValue,
  period: string,
): Promise<SaveReportInput> {
  const base = {
    reportType,
    reportingPeriod: period,
    status: "final" as const,
  };

  switch (reportType) {
    case "business_confidence": {
      const s = await getSnapshot(claims);
      return {
        ...base,
        title: `Business Confidence Report - ${period}`,
        summary: `Business Confidence Score ${s.score}/100 (${s.statusLabel}).`,
        metrics: [
          metric("Confidence Score", `${s.score}/100`),
          ...s.areas.map((a) => metric(a.label, `${a.score}/100`)),
        ],
        sections: s.areas.map((a) => ({
          title: a.label,
          body: `${a.score}/100. ${a.note}`,
        })),
        sourceModules: s.areas.map((a) => a.key),
      };
    }

    case "compliance_overview": {
      const obs = await listObligations(claims);
      const overdue = obs.filter((o) => o.status === "overdue");
      const action = obs.filter((o) => o.status === "action_required");
      const completed = obs.filter((o) => o.status === "completed");
      return {
        ...base,
        title: `Compliance Overview - ${period}`,
        summary: `${obs.length} obligations tracked; ${overdue.length} overdue, ${action.length} needing action.`,
        metrics: [
          metric("Obligations", obs.length),
          metric("Overdue", overdue.length),
          metric("Action required", action.length),
          metric("Completed", completed.length),
        ],
        findings: [...overdue, ...action].slice(0, 20).map((o) => o.title),
        sourceModules: ["compliance"],
      };
    }

    case "risk_summary": {
      const risks = await listRisks(claims);
      const open = risks.filter((r) => r.status === "open");
      const high = risks.filter(
        (r) => r.residualRating === "high" || r.residualRating === "critical",
      );
      return {
        ...base,
        title: `Risk Summary - ${period}`,
        summary: `${open.length} open risks; ${high.length} at high or critical residual severity.`,
        metrics: [
          metric("Open risks", open.length),
          metric("High/critical", high.length),
          metric("Total logged", risks.length),
        ],
        findings: high.slice(0, 20).map((r) => r.riskTitle),
        sourceModules: ["risk"],
      };
    }

    case "monthly_activity": {
      const acts = await listActivities(claims, 100);
      const monthAgo = Date.now() - 30 * 864e5;
      const recent = acts.filter(
        (a) => new Date(a.createdAt).getTime() >= monthAgo,
      );
      const byModule = new Set(recent.map((a) => a.module));
      return {
        ...base,
        title: `Monthly Activity Report - ${period}`,
        summary: `${recent.length} updates this month across ${byModule.size} modules.`,
        metrics: [
          metric("Updates this month", recent.length),
          metric("Modules active", byModule.size),
        ],
        findings: recent.slice(0, 25).map((a) => `${a.title} (${a.module})`),
        sourceModules: [...byModule],
      };
    }

    case "training_summary": {
      const rows = await listAssignments(claims);
      const completed = rows.filter((a) => a.status === "completed");
      const overdue = rows.filter((a) => a.status === "overdue");
      const rate = rows.length
        ? Math.round((completed.length / rows.length) * 100)
        : 0;
      return {
        ...base,
        title: `Training and Learning Summary - ${period}`,
        summary: `${rows.length} assignments; ${completed.length} completed (${rate}%), ${overdue.length} overdue.`,
        metrics: [
          metric("Assignments", rows.length),
          metric("Completed", completed.length),
          metric("Completion rate", `${rate}%`),
          metric("Overdue", overdue.length),
        ],
        sourceModules: ["academy"],
      };
    }

    default: {
      // executive_summary
      const [s, briefing] = await Promise.all([
        getSnapshot(claims),
        getJovaBriefing(claims),
      ]);
      const high = briefing.findings.filter(
        (f) => f.severity === "critical" || f.severity === "high",
      );
      return {
        ...base,
        title: `Executive Summary - ${period}`,
        summary: `Overall position is ${s.statusLabel.toLowerCase()} at ${s.score}/100, with ${s.metrics.overdueObligations} overdue and ${s.priorities.length} open priorities.`,
        metrics: [
          metric("Confidence Score", `${s.score}/100`),
          metric("Open priorities", s.priorities.length),
          metric("Overdue", s.metrics.overdueObligations),
          metric("High/critical risks", s.metrics.criticalHighRisks),
        ],
        findings: high.slice(0, 15).map((f) => f.title),
        priorityActions: s.priorities.map((p) => p.label),
        sections: [
          {
            title: "Position",
            body: `Business Confidence ${s.score}/100 (${s.statusLabel}).`,
          },
        ],
        sourceModules: s.areas.map((a) => a.key),
      };
    }
  }
}

export function deleteReport(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(reports)
      .where(eq(reports.id, id))
      .returning({ id: reports.id });
    return rows.length > 0;
  });
}
