import { desc, eq } from "drizzle-orm";
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

export interface SaveReportInput {
  reportType: ReportTypeValue;
  title: string;
  reportingPeriod?: string | null;
  summary?: string | null;
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
        status: "final",
        summary: input.summary ?? null,
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
        summary: reports.summary,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .orderBy(desc(reports.createdAt)),
  );
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
