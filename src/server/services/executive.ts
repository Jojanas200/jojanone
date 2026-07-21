import { sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  contracts,
  employees,
  governanceRecords,
  processingActivities,
  risks,
  tenderOpportunities,
} from "../db/schema";

// Executive - board-level roll-up. Read-only cross-module totals to accompany
// the Business Confidence Score (which the page pulls from dashboard.getSnapshot).
// One withUser() transaction, RLS-scoped to the caller's workspace.

export interface ExecutiveTotals {
  activeContracts: number;
  activeEmployees: number;
  openRisks: number;
  processingActivities: number;
  governanceRecords: number;
  tenderPipeline: number; // count of live (non-closed) opportunities
  tenderPipelineValue: number; // sum of contractValue, minor units
}

const count = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);

export function getExecutiveTotals(
  claims: UserClaims,
): Promise<ExecutiveTotals> {
  return withUser(claims, async (tx) => {
    const [con, emp, rsk, roc, gov, ten] = await Promise.all([
      tx
        .select({ n: sql<number>`count(*)` })
        .from(contracts)
        .where(
          sql`${contracts.deletedAt} is null and ${contracts.status} not in ('archived','expired')`,
        ),
      tx
        .select({ n: sql<number>`count(*)` })
        .from(employees)
        .where(
          sql`${employees.deletedAt} is null and ${employees.employmentStatus} <> 'archived'`,
        ),
      tx
        .select({ n: sql<number>`count(*)` })
        .from(risks)
        .where(sql`${risks.deletedAt} is null and ${risks.status} = 'open'`),
      tx.select({ n: sql<number>`count(*)` }).from(processingActivities),
      tx.select({ n: sql<number>`count(*)` }).from(governanceRecords),
      tx
        .select({
          n: sql<number>`count(*)`,
          value: sql<number>`coalesce(sum(${tenderOpportunities.contractValue}), 0)`,
        })
        .from(tenderOpportunities)
        .where(
          sql`${tenderOpportunities.status} not in ('won','lost','no_bid','archived')`,
        ),
    ]);

    return {
      activeContracts: count(con),
      activeEmployees: count(emp),
      openRisks: count(rsk),
      processingActivities: count(roc),
      governanceRecords: count(gov),
      tenderPipeline: Number(ten[0]?.n ?? 0),
      tenderPipelineValue: Number(ten[0]?.value ?? 0),
    };
  });
}
