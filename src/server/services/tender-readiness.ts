import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  bidAssessments,
  tenderRequirements,
  tenderResponses,
} from "../db/schema";
import { recordActivity } from "./activity";
import { listPolicies } from "./policies";
import { listEvidence } from "./evidence";
import { listObligations } from "./compliance";
import { getGdprAssessment } from "./gdpr-registers";
import { listTenderOpportunities } from "./tender";
import { saveReport } from "./reports";
import { getQuestionSet } from "./question-sets";
import {
  TENDER_BID_CHECKLIST,
  TENDER_DIMENSIONS,
  type CreateTenderRequirementInput,
  type CreateTenderResponseInput,
  type UpdateTenderRequirementInput,
  type UpdateTenderResponseInput,
} from "../../shared/schemas/tender-readiness";

// Tender readiness: a requirements checklist, response drafts, and a bid/no-bid
// decision assessment. RLS-scoped via withUser().

// --- Requirements -----------------------------------------------------------
export function listTenderRequirements(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(tenderRequirements)
      .orderBy(desc(tenderRequirements.mandatory), tenderRequirements.title),
  );
}

export function createTenderRequirement(
  claims: UserClaims,
  workspaceId: string,
  input: CreateTenderRequirementInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(tenderRequirements)
      .values({
        workspaceId,
        opportunityId: input.opportunityId ?? null,
        requirementType: input.requirementType,
        title: input.title,
        description: input.description ?? null,
        mandatory: input.mandatory,
        weighting: input.weighting,
        status: input.status,
        owner: input.owner ?? null,
        dueDate: input.dueDate ?? null,
        evidenceReference: input.evidenceReference ?? null,
        sourceSection: input.sourceSection ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "tender-ready",
      action: "created",
      title: `Requirement: ${rows[0].title}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateTenderRequirement(
  claims: UserClaims,
  id: string,
  input: UpdateTenderRequirementInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(tenderRequirements)
      .set(input)
      .where(eq(tenderRequirements.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteTenderRequirement(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(tenderRequirements)
      .where(eq(tenderRequirements.id, id))
      .returning({ id: tenderRequirements.id });
    return rows.length > 0;
  });
}

// --- Responses --------------------------------------------------------------
export function listTenderResponses(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx.select().from(tenderResponses).orderBy(desc(tenderResponses.updatedAt)),
  );
}

export function createTenderResponse(
  claims: UserClaims,
  workspaceId: string,
  input: CreateTenderResponseInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(tenderResponses)
      .values({
        workspaceId,
        opportunityId: input.opportunityId ?? null,
        version: input.version,
        sectionTitle: input.sectionTitle ?? null,
        question: input.question ?? null,
        wordLimit: input.wordLimit,
        responseText: input.responseText ?? null,
        status: input.status,
        reviewNotes: input.reviewNotes ?? null,
        owner: input.owner ?? null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "tender-ready",
      action: "created",
      title: `Response: ${rows[0].sectionTitle ?? "Untitled"}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateTenderResponse(
  claims: UserClaims,
  id: string,
  input: UpdateTenderResponseInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(tenderResponses)
      .set(input)
      .where(eq(tenderResponses.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteTenderResponse(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(tenderResponses)
      .where(eq(tenderResponses.id, id))
      .returning({ id: tenderResponses.id });
    return rows.length > 0;
  });
}

// --- Bid assessment (single current, scored by dimension) -------------------
function scoreBid(
  answers: Record<string, boolean>,
  checklist: typeof TENDER_BID_CHECKLIST = TENDER_BID_CHECKLIST,
) {
  const met = (list: typeof TENDER_BID_CHECKLIST) =>
    list.length
      ? Math.round(
          (list.filter((q) => answers[q.key]).length / list.length) * 100,
        )
      : 0;
  const dim = Object.fromEntries(
    TENDER_DIMENSIONS.map((d) => [
      d,
      met(checklist.filter((q) => q.dim === d)),
    ]),
  ) as Record<(typeof TENDER_DIMENSIONS)[number], number>;
  const overall = Math.round(
    TENDER_DIMENSIONS.reduce((s, d) => s + dim[d], 0) /
      TENDER_DIMENSIONS.length,
  );
  const gaps = checklist.filter((q) => !answers[q.key]).map((q) => q.label);
  const strengths = checklist.filter((q) => answers[q.key]).map((q) => q.label);
  const recommendation =
    overall >= 60 ? "bid" : overall >= 40 ? "conditional" : "no_bid";
  return { dim, overall, gaps, strengths, recommendation };
}

export function getBidAssessment(claims: UserClaims) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(bidAssessments)
      .orderBy(desc(bidAssessments.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function saveBidAssessment(
  claims: UserClaims,
  workspaceId: string,
  input: {
    answers: Record<string, boolean>;
    decision?: "pending" | "bid" | "no_bid";
    decisionReason?: string | null;
  },
) {
  return (async () => {
    const checklist = (await getQuestionSet(
      "tender_bid_checklist",
    )) as unknown as typeof TENDER_BID_CHECKLIST;
    return withUser(claims, async (tx) => {
      const { dim, overall, gaps, strengths, recommendation } = scoreBid(
        input.answers,
        checklist,
      );
      const existing = (
        await tx
          .select({ id: bidAssessments.id })
          .from(bidAssessments)
          .orderBy(desc(bidAssessments.updatedAt))
          .limit(1)
      )[0];
      const values = {
        strategicFitScore: dim.strategic_fit,
        eligibilityScore: dim.eligibility,
        capacityScore: dim.capacity,
        evidenceScore: dim.evidence,
        commercialScore: dim.commercial,
        deliveryRiskScore: dim.delivery_risk,
        overallScore: overall,
        answers: input.answers,
        strengths,
        gaps,
        recommendation,
        ...(input.decision ? { decision: input.decision } : {}),
        ...(input.decisionReason !== undefined
          ? { decisionReason: input.decisionReason }
          : {}),
        completedAt: sql`now()`,
      };
      const row = existing
        ? (
            await tx
              .update(bidAssessments)
              .set(values)
              .where(eq(bidAssessments.id, existing.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(bidAssessments)
              .values({ workspaceId, ...values })
              .returning()
          )[0];
      await recordActivity(tx, workspaceId, {
        module: "tender-ready",
        action: "updated",
        title: `Bid assessment (${overall}%, ${recommendation})`,
        referenceId: row.id,
      });
      return row;
    });
  })();
}

// --- Tender readiness (derived score + pipeline metrics) ---------------------
// A deterministic overall readiness score from recorded policies, evidence,
// compliance and GDPR, plus live tender-pipeline metrics. Read-only.
const ACTIVE_OPP_STATUSES = new Set([
  "identified",
  "assessing",
  "bid",
  "drafting",
  "review",
  "submitted",
]);

export async function getTenderReadiness(claims: UserClaims) {
  const [policies, evidence, obligations, gdpr, opps, reqs, responses] =
    await Promise.all([
      listPolicies(claims),
      listEvidence(claims),
      listObligations(claims),
      getGdprAssessment(claims),
      listTenderOpportunities(claims),
      listTenderRequirements(claims),
      listTenderResponses(claims),
    ]);

  const pct = (part: number, total: number) =>
    total ? Math.round((part / total) * 100) : 0;

  const policyScore = pct(
    policies.filter((p) => p.status === "active").length,
    policies.length,
  );
  const evidenceScore = pct(
    evidence.filter((e) => e.status === "current").length,
    evidence.length,
  );
  const insuranceOk = obligations.some(
    (o) =>
      (o.category === "insurance" || o.category === "insurance_business") &&
      o.status === "completed",
  );
  const gdprOk = gdpr ? gdpr.score >= 60 : false;
  const now = Date.now();
  const isOverdue = (o: (typeof obligations)[number]) =>
    o.status === "overdue" ||
    (!!o.dueDate &&
      new Date(o.dueDate).getTime() < now &&
      o.status !== "completed" &&
      o.status !== "not_applicable");
  const complianceOk = !obligations.some(isOverdue);
  const b100 = (v: boolean) => (v ? 100 : 0);
  const readinessScore = Math.round(
    (policyScore +
      evidenceScore +
      b100(insuranceOk) +
      b100(gdprOk) +
      b100(complianceOk)) /
      5,
  );

  const withinDays = (d: string | null, days: number) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - now) / 86400000;
    return diff >= 0 && diff <= days;
  };

  const activeOpps = opps.filter((o) => ACTIVE_OPP_STATUSES.has(o.status));
  const bidPending = opps.filter((o) => o.status === "assessing");
  const deadlines30 = opps.filter((o) => withinDays(o.submissionDeadline, 30));
  const reqIncomplete = reqs.filter((r) => r.status !== "met");
  const responsesToReview = responses.filter((r) => r.status === "in_review");

  const gaps: string[] = [];
  if (!insuranceOk) gaps.push("Insurance evidence not current");
  if (!gdprOk) gaps.push("GDPR readiness below threshold");
  if (!complianceOk) gaps.push("Overdue compliance obligations present");
  if (evidenceScore < 60) gaps.push("Evidence library needs expansion");
  if (policyScore < 60) gaps.push("Policy coverage needs strengthening");

  const recommendations = [
    ...reqIncomplete.slice(0, 6).map((r) => `Close requirement: ${r.title}`),
    ...gaps.map((g) => `Address: ${g}`),
  ].slice(0, 8);

  return {
    readinessScore,
    policyScore,
    evidenceScore,
    insuranceOk,
    gdprOk,
    complianceOk,
    metrics: {
      opportunities: opps.length,
      activeOpps: activeOpps.length,
      bidPending: bidPending.length,
      deadlines30: deadlines30.length,
      reqIncomplete: reqIncomplete.length,
      responsesToReview: responsesToReview.length,
      submitted: opps.filter(
        (o) => o.status === "submitted" || o.status === "won",
      ).length,
    },
    gaps,
    recommendations,
  };
}

export async function generateTenderReport(
  claims: UserClaims,
  workspaceId: string,
) {
  const r = await getTenderReadiness(claims);
  const period = new Date().toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  return saveReport(claims, workspaceId, {
    reportType: "executive_summary",
    title: `Tender Readiness Report - ${period}`,
    reportingPeriod: "Point in time",
    status: "final",
    summary: `Tender readiness ${r.readinessScore}/100. ${r.metrics.activeOpps} active opportunities, ${r.metrics.deadlines30} submission deadlines within 30 days.`,
    metrics: [
      { label: "Readiness score", value: `${r.readinessScore}/100` },
      { label: "Active opportunities", value: String(r.metrics.activeOpps) },
      { label: "Bid decisions pending", value: String(r.metrics.bidPending) },
      { label: "Deadlines <= 30d", value: String(r.metrics.deadlines30) },
      {
        label: "Requirements incomplete",
        value: String(r.metrics.reqIncomplete),
      },
      {
        label: "Responses to review",
        value: String(r.metrics.responsesToReview),
      },
    ],
    findings: r.gaps,
    priorityActions: r.recommendations,
    sections: [
      {
        title: "Opportunities",
        body: `${r.metrics.opportunities} tracked, ${r.metrics.activeOpps} active, ${r.metrics.submitted} submitted or won.`,
      },
      {
        title: "Evidence and policies",
        body: `Policy score ${r.policyScore}/100; evidence score ${r.evidenceScore}/100.`,
      },
      {
        title: "Readiness checks",
        body: `Insurance ${r.insuranceOk ? "current" : "attention"}; GDPR ${r.gdprOk ? "ok" : "below threshold"}; compliance ${r.complianceOk ? "on track" : "overdue items"}.`,
      },
    ],
    sourceModules: ["governance", "contracts", "hr", "compliance", "gdpr"],
  });
}
