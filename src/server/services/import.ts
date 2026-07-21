import type { PgTable } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";
import { withUser, type UserClaims } from "../db";
import { contracts, employees, complianceObligations } from "../db/schema";
import { recordActivity } from "./activity";
import { createContractSchema } from "../../shared/schemas/contract";
import { createEmployeeSchema } from "../../shared/schemas/hr";
import { createObligationSchema } from "../../shared/schemas/compliance";

// Bulk import - the counterpart to the CSV export. A CSV is parsed, each row is
// validated against the module's own create-schema (single source of truth),
// and the valid rows are inserted in ONE withUser() transaction, each emitting
// an audit event. Invalid rows are reported with a reason and never committed.

type ColumnKind = "string" | "int" | "money";
interface ImportColumn {
  header: string; // canonical header shown in the template
  field: string; // schema field it maps to
  kind: ColumnKind;
}
interface ImportSpec {
  module: string;
  label: string;
  table: PgTable;
  schema: ZodType;
  titleField: string;
  columns: ImportColumn[];
}

export const IMPORT_SPECS: Record<string, ImportSpec> = {
  contracts: {
    module: "contracts",
    label: "Contracts",
    table: contracts,
    schema: createContractSchema,
    titleField: "title",
    columns: [
      { header: "title", field: "title", kind: "string" },
      { header: "contractType", field: "contractType", kind: "string" },
      { header: "counterparty", field: "counterparty", kind: "string" },
      { header: "status", field: "status", kind: "string" },
      { header: "value", field: "valueMinor", kind: "money" },
      { header: "startDate", field: "startDate", kind: "string" },
      { header: "endDate", field: "endDate", kind: "string" },
      { header: "renewalDate", field: "renewalDate", kind: "string" },
      { header: "riskLevel", field: "riskLevel", kind: "string" },
      { header: "owner", field: "owner", kind: "string" },
    ],
  },
  employees: {
    module: "hr",
    label: "People",
    table: employees,
    schema: createEmployeeSchema,
    titleField: "fullName",
    columns: [
      { header: "fullName", field: "fullName", kind: "string" },
      { header: "jobTitle", field: "jobTitle", kind: "string" },
      { header: "department", field: "department", kind: "string" },
      { header: "employmentType", field: "employmentType", kind: "string" },
      { header: "employmentStatus", field: "employmentStatus", kind: "string" },
      { header: "startDate", field: "startDate", kind: "string" },
      {
        header: "rightToWorkStatus",
        field: "rightToWorkStatus",
        kind: "string",
      },
      {
        header: "rightToWorkExpiry",
        field: "rightToWorkExpiry",
        kind: "string",
      },
      { header: "trainingStatus", field: "trainingStatus", kind: "string" },
      { header: "riskLevel", field: "riskLevel", kind: "string" },
    ],
  },
  obligations: {
    module: "compliance",
    label: "Compliance obligations",
    table: complianceObligations,
    schema: createObligationSchema,
    titleField: "title",
    columns: [
      { header: "title", field: "title", kind: "string" },
      { header: "category", field: "category", kind: "string" },
      { header: "status", field: "status", kind: "string" },
      { header: "priority", field: "priority", kind: "string" },
      { header: "dueDate", field: "dueDate", kind: "string" },
      { header: "regulator", field: "regulator", kind: "string" },
      { header: "owner", field: "owner", kind: "string" },
      { header: "recurrence", field: "recurrence", kind: "string" },
    ],
  },
};

export const IMPORT_KEYS = Object.keys(IMPORT_SPECS);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Minimal RFC-4180 CSV parser: quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else field += ch;
  }
  // trailing field/row (no final newline)
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ImportRowError {
  row: number; // 1-based data row (excludes header)
  message: string;
}
export interface ImportPreview {
  dataset: string;
  columns: string[];
  totalRows: number;
  validRows: Record<string, unknown>[];
  errors: ImportRowError[];
}

/** Parse + validate only - no writes. Used for the preview step. */
export function analyseCsv(dataset: string, csv: string): ImportPreview | null {
  const spec = IMPORT_SPECS[dataset];
  if (!spec) return null;

  const rows = parseCsv(csv);
  const columns = spec.columns.map((c) => c.header);
  const preview: ImportPreview = {
    dataset,
    columns,
    totalRows: 0,
    validRows: [],
    errors: [],
  };
  if (rows.length === 0) return preview;

  const headerRow = rows[0].map(norm);
  // Map each spec column to its position in the uploaded header, if present.
  const positions = spec.columns.map((c) => ({
    col: c,
    idx: headerRow.indexOf(norm(c.header)),
  }));

  for (let r = 1; r < rows.length; r++) {
    preview.totalRows++;
    const cells = rows[r];
    const raw: Record<string, unknown> = {};
    let cellError: string | null = null;

    for (const { col, idx } of positions) {
      if (idx === -1) continue;
      const cell = (cells[idx] ?? "").trim();
      if (cell === "") continue; // let schema defaults / nullish apply
      if (col.kind === "money") {
        const n = Number(cell.replace(/[£,\s]/g, ""));
        if (Number.isNaN(n)) {
          cellError = `${col.header}: "${cell}" is not a number`;
          break;
        }
        raw[col.field] = Math.round(n * 100);
      } else if (col.kind === "int") {
        const n = Number(cell);
        if (Number.isNaN(n)) {
          cellError = `${col.header}: "${cell}" is not a number`;
          break;
        }
        raw[col.field] = Math.round(n);
      } else {
        raw[col.field] = cell;
      }
    }

    if (cellError) {
      preview.errors.push({ row: preview.totalRows, message: cellError });
      continue;
    }

    const parsed = spec.schema.safeParse(raw);
    if (parsed.success) {
      preview.validRows.push(parsed.data as Record<string, unknown>);
    } else {
      const first = parsed.error.issues[0];
      preview.errors.push({
        row: preview.totalRows,
        message: `${first.path.join(".") || "row"}: ${first.message}`,
      });
    }
  }
  return preview;
}

export interface ImportResult {
  dataset: string;
  inserted: number;
  totalRows: number;
  errors: ImportRowError[];
}

/** Validate then insert the valid rows in a single transaction (atomic batch). */
export function commitImport(
  claims: UserClaims,
  workspaceId: string,
  dataset: string,
  csv: string,
): Promise<ImportResult | null> {
  const spec = IMPORT_SPECS[dataset];
  if (!spec) return Promise.resolve(null);
  const analysis = analyseCsv(dataset, csv);
  if (!analysis) return Promise.resolve(null);

  return withUser(claims, async (tx) => {
    let inserted = 0;
    for (const data of analysis.validRows) {
      const rows = await tx
        // Heterogeneous tables across datasets - validated shape guaranteed above.
        .insert(spec.table)
        .values({
          workspaceId,
          createdBy: claims.sub,
          updatedBy: claims.sub,
          ...data,
        } as never)
        .returning({ id: (spec.table as unknown as { id: never }).id });
      inserted++;
      await recordActivity(tx, workspaceId, {
        module: spec.module,
        action: "created",
        title: String(data[spec.titleField] ?? "Imported record"),
        referenceId: (rows[0] as { id: string }).id,
        description: `${spec.label} imported`,
      });
    }
    return {
      dataset,
      inserted,
      totalRows: analysis.totalRows,
      errors: analysis.errors,
    };
  });
}

/** A downloadable header template for a dataset. */
export function templateCsv(dataset: string): string | null {
  const spec = IMPORT_SPECS[dataset];
  if (!spec) return null;
  return spec.columns.map((c) => c.header).join(",") + "\r\n";
}
