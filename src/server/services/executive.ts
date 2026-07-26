import { and, desc, inArray, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  contracts,
  dueDiligenceItems,
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

// --- Decisions required ------------------------------------------------------
// Real governance records still awaiting sign-off (draft/pending, not yet
// approved). No new "decisions" table - these are actual records you can open.
export interface PendingDecision {
  id: string;
  title: string;
  recordType: string;
  status: string;
  description: string | null;
  meetingDate: string | null;
}

export function listPendingDecisions(
  claims: UserClaims,
): Promise<PendingDecision[]> {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: governanceRecords.id,
        title: governanceRecords.title,
        recordType: governanceRecords.recordType,
        status: governanceRecords.status,
        description: governanceRecords.description,
        meetingDate: governanceRecords.meetingDate,
      })
      .from(governanceRecords)
      .where(
        and(
          inArray(governanceRecords.status, ["draft", "pending"]),
          sql`${governanceRecords.approvalStatus} <> 'approved'`,
        ),
      )
      .orderBy(desc(governanceRecords.createdAt))
      .limit(8),
  );
}

// --- Growth readiness signals (honest facts, not a synthetic /100) -----------
// Real counts from existing data; the full weighted readiness scores land when
// their backing tables (data room, assessments, tender requirements) exist.
export interface GrowthSignals {
  ddReady: number;
  ddTotal: number;
  tenderActive: number;
  tenderValueMinor: number;
  tenderDeadlines30d: number;
}

const num = (v: unknown) => Number(v ?? 0);
const LIVE_TENDER = sql`status not in ('won','lost','no_bid','archived')`;

export function getGrowthSignals(claims: UserClaims): Promise<GrowthSignals> {
  return withUser(claims, async (tx) => {
    const [dd, ten] = await Promise.all([
      tx
        .select({
          total: sql<number>`count(*) filter (where ${dueDiligenceItems.status} <> 'not_applicable')`,
          ready: sql<number>`count(*) filter (where ${dueDiligenceItems.status} = 'ready')`,
        })
        .from(dueDiligenceItems),
      tx
        .select({
          active: sql<number>`count(*) filter (where ${LIVE_TENDER})`,
          value: sql<number>`coalesce(sum(${tenderOpportunities.contractValue}) filter (where ${LIVE_TENDER}), 0)`,
          deadlines: sql<number>`count(*) filter (where ${LIVE_TENDER} and ${tenderOpportunities.submissionDeadline} between current_date and current_date + 30)`,
        })
        .from(tenderOpportunities),
    ]);
    return {
      ddReady: num(dd[0]?.ready),
      ddTotal: num(dd[0]?.total),
      tenderActive: num(ten[0]?.active),
      tenderValueMinor: num(ten[0]?.value),
      tenderDeadlines30d: num(ten[0]?.deadlines),
    };
  });
}
