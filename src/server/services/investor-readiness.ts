import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  dataRoomItems,
  investorProfiles,
  investorReadinessAssessments,
} from "../db/schema";
import { recordActivity } from "./activity";
import { listDueDiligenceItems } from "./investor";
import { saveReport } from "./reports";
import {
  INVESTOR_ASSESSMENT_ITEMS,
  INVESTOR_DIMENSIONS,
  type AssessmentQuestion,
  type CreateDataRoomItemInput,
  type InvestorAssessmentItem,
  type InvestorDimension,
  type SaveInvestorProfileInput,
  type UpdateDataRoomItemInput,
} from "../../shared/schemas/investor-readiness";
import { getQuestionSet } from "./question-sets";

// Investor readiness: a single current fundraising profile, a data-room tracker,
// and a scored readiness self-assessment. RLS-scoped via withUser().

// --- Investor profile (single current record, upsert) -----------------------
export function getInvestorProfile(claims: UserClaims) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(investorProfiles)
      .orderBy(desc(investorProfiles.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function saveInvestorProfile(
  claims: UserClaims,
  workspaceId: string,
  input: SaveInvestorProfileInput,
) {
  return withUser(claims, async (tx) => {
    const existing = (
      await tx
        .select({ id: investorProfiles.id })
        .from(investorProfiles)
        .orderBy(desc(investorProfiles.updatedAt))
        .limit(1)
    )[0];
    const values = {
      fundingStage: input.fundingStage,
      amountSought: input.amountSought,
      currency: input.currency,
      fundingPurpose: input.fundingPurpose ?? null,
      targetCloseDate: input.targetCloseDate ?? null,
      currentRevenueBand: input.currentRevenueBand ?? null,
      growthSummary: input.growthSummary ?? null,
      tractionSummary: input.tractionSummary ?? null,
      marketSummary: input.marketSummary ?? null,
      teamSummary: input.teamSummary ?? null,
      investmentType: input.investmentType,
      status: input.status,
      updatedBy: claims.sub,
    };
    const row = existing
      ? (
          await tx
            .update(investorProfiles)
            .set(values)
            .where(eq(investorProfiles.id, existing.id))
            .returning()
        )[0]
      : (
          await tx
            .insert(investorProfiles)
            .values({ workspaceId, createdBy: claims.sub, ...values })
            .returning()
        )[0];
    return row;
  });
}

// --- Data room items --------------------------------------------------------
export function listDataRoomItems(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(dataRoomItems)
      .orderBy(dataRoomItems.folder, dataRoomItems.title),
  );
}

export function createDataRoomItem(
  claims: UserClaims,
  workspaceId: string,
  input: CreateDataRoomItemInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(dataRoomItems)
      .values({
        workspaceId,
        folder: input.folder,
        title: input.title,
        documentType: input.documentType ?? null,
        version: input.version,
        status: input.status,
        confidentiality: input.confidentiality,
        reviewDate: input.reviewDate ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "investor-ready",
      action: "created",
      title: `Data room: ${rows[0].title}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateDataRoomItem(
  claims: UserClaims,
  id: string,
  input: UpdateDataRoomItemInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(dataRoomItems)
      .set(input)
      .where(eq(dataRoomItems.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteDataRoomItem(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(dataRoomItems)
      .where(eq(dataRoomItems.id, id))
      .returning({ id: dataRoomItems.id });
    return rows.length > 0;
  });
}

// --- Readiness assessment (single current, scored by dimension) -------------
// Deterministic weighted scoring: yes = 1, partial = 0.5, no/unsure = 0, and
// "not applicable" answers are excluded from the denominator entirely.
const ANSWER_WEIGHT: Record<string, number> = {
  yes: 1,
  partial: 0.5,
  no: 0,
  unsure: 0,
};

function scoreQuestions(
  qs: AssessmentQuestion[],
  answers: Record<string, string>,
) {
  let points = 0;
  let answered = 0;
  for (const q of qs) {
    const a = answers[q.id];
    if (!a || a === "na") continue;
    answered += 1;
    points += ANSWER_WEIGHT[a] ?? 0;
  }
  return answered ? Math.round((points / answered) * 100) : 0;
}

function scoreReadiness(
  answers: Record<string, string>,
  items: readonly InvestorAssessmentItem[] = INVESTOR_ASSESSMENT_ITEMS,
) {
  const dimScore = Object.fromEntries(
    INVESTOR_DIMENSIONS.map((d) => [
      d,
      scoreQuestions(
        items.filter((q) => q.dim === d),
        answers,
      ),
    ]),
  ) as Record<InvestorDimension, number>;
  const overall = scoreQuestions([...items], answers);
  const gaps = items
    .filter((q) => {
      const a = answers[q.id];
      return a && a !== "na" && a !== "yes";
    })
    .map((q) => q.text);
  const redFlags = items
    .filter((q) => q.redFlag && answers[q.id] === "no")
    .map((q) => q.text);
  const recommendedActions = gaps.slice(0, 8).map((g) => `Address: ${g}`);
  return { overall, dimScore, gaps, redFlags, recommendedActions };
}

export function getReadinessAssessment(claims: UserClaims) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(investorReadinessAssessments)
      .orderBy(desc(investorReadinessAssessments.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function saveReadinessAssessment(
  claims: UserClaims,
  workspaceId: string,
  answers: Record<string, string>,
) {
  return (async () => {
    const items = (await getQuestionSet(
      "investor_assessment",
    )) as unknown as InvestorAssessmentItem[];
    return withUser(claims, async (tx) => {
      const { overall, dimScore, gaps, redFlags, recommendedActions } =
        scoreReadiness(answers, items);
      const existing = (
        await tx
          .select({ id: investorReadinessAssessments.id })
          .from(investorReadinessAssessments)
          .orderBy(desc(investorReadinessAssessments.updatedAt))
          .limit(1)
      )[0];
      const values = {
        answers,
        overallScore: overall,
        corporateScore: dimScore.corporate,
        financialScore: dimScore.financial,
        legalScore: dimScore.legal,
        complianceScore: dimScore.compliance,
        commercialScore: dimScore.commercial,
        peopleScore: dimScore.people,
        dataRoomScore: dimScore.data_room,
        gaps,
        redFlags,
        recommendedActions,
        status: "completed" as const,
        completedAt: sql`now()`,
      };
      const row = existing
        ? (
            await tx
              .update(investorReadinessAssessments)
              .set(values)
              .where(eq(investorReadinessAssessments.id, existing.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(investorReadinessAssessments)
              .values({ workspaceId, ...values })
              .returning()
          )[0];
      await recordActivity(tx, workspaceId, {
        module: "investor-ready",
        action: "updated",
        title: `Investor readiness (${overall}%)`,
        referenceId: row.id,
      });
      return row;
    });
  })();
}

// --- Generate an Investor Readiness Report into the Reports library ----------
const DIMENSION_LABEL: Record<InvestorDimension, string> = {
  corporate: "Corporate structure",
  financial: "Financial records",
  legal: "Legal and contracts",
  compliance: "Compliance and data",
  commercial: "Commercial and market",
  people: "People",
  data_room: "Data room",
};

export async function generateInvestorReport(
  claims: UserClaims,
  workspaceId: string,
) {
  const [assessment, profile, dataRoom, dd] = await Promise.all([
    getReadinessAssessment(claims),
    getInvestorProfile(claims),
    listDataRoomItems(claims),
    listDueDiligenceItems(claims),
  ]);

  const overall = assessment?.overallScore ?? 0;
  const ready = dd.filter((i) => i.status === "ready").length;
  const missing = dd.filter((i) => i.status === "missing").length;
  const needsReview = dd.filter((i) => i.status === "needs_review").length;
  const drReady = dataRoom.filter((i) => i.status === "ready").length;
  const drPct = dataRoom.length
    ? Math.round((drReady / dataRoom.length) * 100)
    : 0;
  const gaps = (assessment?.gaps as string[] | undefined) ?? [];
  const redFlags = (assessment?.redFlags as string[] | undefined) ?? [];
  const actions =
    (assessment?.recommendedActions as string[] | undefined) ?? [];

  const dimScores: Record<InvestorDimension, number> = {
    corporate: assessment?.corporateScore ?? 0,
    financial: assessment?.financialScore ?? 0,
    legal: assessment?.legalScore ?? 0,
    compliance: assessment?.complianceScore ?? 0,
    commercial: assessment?.commercialScore ?? 0,
    people: assessment?.peopleScore ?? 0,
    data_room: assessment?.dataRoomScore ?? 0,
  };

  const period = new Date().toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

  return saveReport(claims, workspaceId, {
    reportType: "executive_summary",
    title: `Investor Readiness Report - ${period}`,
    reportingPeriod: "Point in time",
    status: "final",
    summary: `Overall investor readiness ${overall}/100. ${ready} due-diligence items ready, ${missing} missing, ${needsReview} needing review. Data room ${drPct}% ready.`,
    metrics: [
      { label: "Overall readiness", value: `${overall}/100` },
      { label: "Ready items", value: String(ready) },
      { label: "Missing", value: String(missing) },
      { label: "Needs review", value: String(needsReview) },
      { label: "Data room ready", value: `${drPct}%` },
      { label: "Red flags", value: String(redFlags.length) },
    ],
    findings: gaps.slice(0, 10),
    priorityActions: actions.slice(0, 8),
    sections: [
      {
        title: "Funding profile",
        body: profile
          ? `${profile.fundingStage} - seeking ${profile.currency} ${profile.amountSought.toLocaleString()}${
              profile.fundingPurpose ? ` for ${profile.fundingPurpose}` : ""
            }.`
          : "No funding profile recorded.",
      },
      ...INVESTOR_DIMENSIONS.map((d) => ({
        title: DIMENSION_LABEL[d],
        body: `Score ${dimScores[d]}/100.`,
      })),
      {
        title: "Red flags",
        body: redFlags.length ? redFlags.join("; ") : "No red flags recorded.",
      },
    ],
    sourceModules: [
      "governance",
      "contracts",
      "hr",
      "compliance",
      "gdpr",
      "risk",
    ],
  });
}
