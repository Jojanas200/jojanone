import { isNull } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  businessProfiles,
  complianceObligations,
  contracts,
  employees,
  evidenceLibraryItems,
  governanceRecords,
  onboardingResponses,
  policies,
  processingActivities,
  risks,
} from "../db/schema";
import {
  missingInitialFields,
  onboardingProgress,
  resumeSectionIndex,
} from "../../shared/onboarding/logic";
import type { OnboardingAnswers } from "../../shared/onboarding/types";

// Business Confidence Score.
//
// Two rules shape this model:
//
// 1. Nothing is assumed. An area earns points for EVIDENCE that it is being
//    managed (coverage) and loses them for open issues (penalties). An empty
//    module therefore scores 0, never 100 - silence is not compliance.
// 2. No score is shown until there is enough to assess. Until then the
//    snapshot reports assessed:false with a null score, and the UI shows
//    "Assessment pending" alongside onboarding progress. Onboarding progress
//    is deliberately a separate number: it measures what we have been told,
//    not how protected the business is.

export type StatusLabel = "Good" | "Needs Attention" | "At Risk";

export interface AreaScore {
  key: string;
  label: string;
  href: string;
  score: number;
  weight: number;
  note: string;
  /** Areas that do not apply to this business are left out of the roll-up. */
  applicable: boolean;
  /** Whether there is any evidence in this area yet. */
  covered: boolean;
}

export interface OnboardingSummary {
  started: boolean;
  completed: boolean;
  percent: number;
  answered: number;
  total: number;
  /** Section index to resume at, for "Continue onboarding". */
  resumeStep: number;
}

export interface Snapshot {
  /** False until the minimum assessment threshold is met. */
  assessed: boolean;
  /** null while assessment is pending - never defaulted to 0 or 100. */
  score: number | null;
  statusLabel: StatusLabel | null;
  onboarding: OnboardingSummary;
  areas: AreaScore[];
  metrics: {
    overdueObligations: number;
    actionRequired: number;
    openRisks: number;
    criticalHighRisks: number;
    peopleGaps: number;
    expiringContracts: number;
  };
  priorities: { label: string; href: string }[];
  /** "Why this score?" - what is working, what is not, what to do next. */
  strengths: string[];
  needsAttention: string[];
  nextStep: { label: string; href: string } | null;
}

/**
 * Records across the modules that let an established workspace be assessed
 * even if it predates the onboarding wizard (or was populated by import).
 */
export const MIN_RECORDS_FOR_ASSESSMENT = 5;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Coverage earned by having n records, saturating at `full`. */
const cover = (n: number, full: number) =>
  full <= 0 ? 0 : clamp((n / full) * 100);

export function getSnapshot(claims: UserClaims): Promise<Snapshot> {
  return withUser(claims, async (tx) => {
    const [obs, rsk, emp, con, roc, gov, pol, evi, onb, prof] =
      await Promise.all([
        tx
          .select({
            id: complianceObligations.id,
            title: complianceObligations.title,
            status: complianceObligations.status,
            dueDate: complianceObligations.dueDate,
          })
          .from(complianceObligations)
          .where(isNull(complianceObligations.deletedAt)),
        tx
          .select({
            id: risks.id,
            title: risks.riskTitle,
            status: risks.status,
            residual: risks.residualRating,
          })
          .from(risks)
          .where(isNull(risks.deletedAt)),
        tx
          .select({
            id: employees.id,
            name: employees.fullName,
            status: employees.employmentStatus,
            rtw: employees.rightToWorkStatus,
            training: employees.trainingStatus,
          })
          .from(employees)
          .where(isNull(employees.deletedAt)),
        tx
          .select({
            id: contracts.id,
            title: contracts.title,
            status: contracts.status,
            risk: contracts.riskLevel,
            endDate: contracts.endDate,
            renewalDate: contracts.renewalDate,
          })
          .from(contracts)
          .where(isNull(contracts.deletedAt)),
        tx
          .select({
            special: processingActivities.specialCategoryData,
            reviewDate: processingActivities.reviewDate,
            status: processingActivities.status,
          })
          .from(processingActivities),
        tx.select({ status: governanceRecords.status }).from(governanceRecords),
        tx
          .select({
            status: policies.status,
            reviewDate: policies.reviewDate,
          })
          .from(policies),
        tx.select({ id: evidenceLibraryItems.id }).from(evidenceLibraryItems),
        tx
          .select({
            answers: onboardingResponses.answers,
            completedAt: onboardingResponses.completedAt,
          })
          .from(onboardingResponses)
          .limit(1),
        tx
          .select({
            employeeCount: businessProfiles.employeeCount,
            contractorCount: businessProfiles.contractorCount,
            profileCompletion: businessProfiles.profileCompletion,
            processesPersonalData: businessProfiles.processesPersonalData,
          })
          .from(businessProfiles)
          .limit(1),
      ]);

    const t = today();
    const soon = addDays(60);
    const priorities: { label: string; href: string }[] = [];
    const profile = prof[0] ?? null;

    // --- Onboarding (progress only - never mistaken for protection) ----------
    const answers = (onb[0]?.answers ?? {}) as OnboardingAnswers;
    const onboardingCompletedAt = onb[0]?.completedAt ?? null;
    const progress = onboardingProgress(answers);
    const onboardingStarted =
      onboardingCompletedAt !== null || Object.keys(answers).length > 0;
    const onboardingComplete =
      onboardingCompletedAt !== null ||
      (onboardingStarted && missingInitialFields(answers).length === 0);
    const onboarding: OnboardingSummary = {
      started: onboardingStarted,
      completed: onboardingComplete,
      percent: progress.percent,
      answered: progress.answered,
      total: progress.total,
      resumeStep: resumeSectionIndex(answers),
    };

    // --- Compliance ----------------------------------------------------------
    const isOverdue = (o: (typeof obs)[number]) =>
      o.status === "overdue" ||
      (!!o.dueDate &&
        o.dueDate < t &&
        o.status !== "completed" &&
        o.status !== "not_applicable");
    const overdueObligations = obs.filter(isOverdue);
    const actionRequired = obs.filter((o) => o.status === "action_required");
    const complianceScore = clamp(
      cover(obs.length, 5) -
        overdueObligations.length * 12 -
        actionRequired.length * 6,
    );
    overdueObligations
      .slice(0, 3)
      .forEach((o) =>
        priorities.push({ label: `Overdue: ${o.title}`, href: "/compliance" }),
      );

    // --- Risk ----------------------------------------------------------------
    const openRisks = rsk.filter((r) => r.status === "open");
    const critical = openRisks.filter((r) => r.residual === "critical");
    const high = openRisks.filter((r) => r.residual === "high");
    const medium = openRisks.filter((r) => r.residual === "medium");
    const riskScore = clamp(
      cover(rsk.length, 5) -
        critical.length * 20 -
        high.length * 10 -
        medium.length * 3,
    );
    [...critical, ...high]
      .slice(0, 3)
      .forEach((r) =>
        priorities.push({ label: `Mitigate risk: ${r.title}`, href: "/risk" }),
      );

    // --- People --------------------------------------------------------------
    const active = emp.filter((e) => e.status !== "archived");
    const rtwGaps = active.filter(
      (e) => e.rtw === "outstanding" || e.rtw === "expired",
    );
    const trainingGaps = active.filter(
      (e) => e.training === "overdue" || e.training === "outstanding",
    );
    const headcount = profile?.employeeCount ?? 0;
    const contractorCount = profile?.contractorCount ?? 0;
    // A business with no staff is not penalised for an empty HR register.
    const peopleApplicable =
      headcount > 0 || contractorCount > 0 || active.length > 0;
    const peopleScore = clamp(
      cover(active.length, Math.max(1, headcount || active.length || 1)) -
        rtwGaps.length * 10 -
        trainingGaps.length * 5,
    );
    rtwGaps
      .slice(0, 2)
      .forEach((e) =>
        priorities.push({ label: `Right-to-work: ${e.name}`, href: "/hr" }),
      );

    // --- Contracts -----------------------------------------------------------
    const expiring = con.filter(
      (c) =>
        c.status !== "archived" &&
        c.status !== "expired" &&
        ((c.endDate && c.endDate >= t && c.endDate <= soon) ||
          (c.renewalDate && c.renewalDate >= t && c.renewalDate <= soon)),
    );
    const expired = con.filter((c) => c.status === "expired");
    const highRiskContracts = con.filter((c) => c.risk === "high");
    const contractsScore = clamp(
      cover(con.length, 5) -
        expired.length * 8 -
        expiring.length * 5 -
        highRiskContracts.length * 4,
    );
    expiring.slice(0, 2).forEach((c) =>
      priorities.push({
        label: `Renewal due: ${c.title}`,
        href: "/contracts",
      }),
    );

    // --- Data protection -----------------------------------------------------
    const activeRopa = roc.filter((a) => a.status === "active");
    const specialNoReview = activeRopa.filter(
      (a) => a.special && !a.reviewDate,
    );
    const gdprScore = clamp(cover(roc.length, 4) - specialNoReview.length * 8);

    // --- Governance ----------------------------------------------------------
    const pendingGov = gov.filter(
      (g) => g.status === "draft" || g.status === "pending",
    );
    const governanceScore = clamp(cover(gov.length, 4) - pendingGov.length * 4);

    // --- Documents & evidence ------------------------------------------------
    const activePolicies = pol.filter((p) => p.status === "active");
    const policiesOverdue = activePolicies.filter(
      (p) => !!p.reviewDate && p.reviewDate < t,
    );
    const documentsScore = clamp(
      cover(activePolicies.length * 2 + evi.length, 10) -
        policiesOverdue.length * 8,
    );
    policiesOverdue.slice(0, 2).forEach(() =>
      priorities.push({
        label: "Policy review overdue",
        href: "/policies",
      }),
    );

    const areas: AreaScore[] = [
      {
        key: "compliance",
        label: "Compliance",
        href: "/compliance",
        score: complianceScore,
        weight: 22,
        applicable: true,
        covered: obs.length > 0,
        note:
          obs.length === 0
            ? "No obligations tracked yet"
            : `${overdueObligations.length} overdue, ${actionRequired.length} action required`,
      },
      {
        key: "risk",
        label: "Risk",
        href: "/risk",
        score: riskScore,
        weight: 20,
        applicable: true,
        covered: rsk.length > 0,
        note:
          rsk.length === 0
            ? "Risk register not started"
            : `${critical.length} critical, ${high.length} high (open)`,
      },
      {
        key: "people",
        label: "People",
        href: "/hr",
        score: peopleScore,
        weight: 13,
        applicable: peopleApplicable,
        covered: active.length > 0,
        note: !peopleApplicable
          ? "No staff recorded - not applicable"
          : active.length === 0
            ? "No people recorded yet"
            : `${rtwGaps.length} RTW gaps, ${trainingGaps.length} training gaps`,
      },
      {
        key: "contracts",
        label: "Contracts",
        href: "/contracts",
        score: contractsScore,
        weight: 13,
        applicable: true,
        covered: con.length > 0,
        note:
          con.length === 0
            ? "No contracts recorded yet"
            : `${expiring.length} expiring soon, ${expired.length} expired`,
      },
      {
        key: "gdpr",
        label: "Data protection",
        href: "/gdpr",
        score: gdprScore,
        weight: 12,
        applicable: true,
        covered: roc.length > 0,
        note:
          roc.length === 0
            ? "No processing activities recorded"
            : `${activeRopa.length} activities, ${specialNoReview.length} special-category unreviewed`,
      },
      {
        key: "governance",
        label: "Governance",
        href: "/governance",
        score: governanceScore,
        weight: 10,
        applicable: true,
        covered: gov.length > 0,
        note:
          gov.length === 0
            ? "No governance records yet"
            : `${pendingGov.length} awaiting approval`,
      },
      {
        key: "documents",
        label: "Documents & evidence",
        href: "/policies",
        score: documentsScore,
        weight: 10,
        applicable: true,
        covered: activePolicies.length > 0 || evi.length > 0,
        note:
          activePolicies.length === 0 && evi.length === 0
            ? "No adopted policies or evidence yet"
            : `${activePolicies.length} adopted, ${evi.length} evidence items, ${policiesOverdue.length} overdue review`,
      },
    ];

    // --- Assessment gate -----------------------------------------------------
    const totalRecords =
      obs.length +
      rsk.length +
      emp.length +
      con.length +
      roc.length +
      gov.length +
      pol.length +
      evi.length;
    const assessed =
      onboardingComplete || totalRecords >= MIN_RECORDS_FOR_ASSESSMENT;

    const scored = areas.filter((a) => a.applicable);
    const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
    const score = !assessed
      ? null
      : totalWeight === 0
        ? null
        : clamp(
            scored.reduce((s, a) => s + a.score * a.weight, 0) / totalWeight,
          );
    const statusLabel: StatusLabel | null =
      score === null
        ? null
        : score >= 80
          ? "Good"
          : score >= 60
            ? "Needs Attention"
            : "At Risk";

    // --- Why this score ------------------------------------------------------
    const strengths: string[] = [];
    const needsAttention: string[] = [];
    if (onboardingComplete) strengths.push("Onboarding completed");
    if ((profile?.profileCompletion ?? 0) >= 80)
      strengths.push("Business profile completed");
    for (const a of scored) {
      if (!a.covered) needsAttention.push(a.note);
      else if (a.score >= 75) strengths.push(`${a.label} in good shape`);
      else needsAttention.push(`${a.label}: ${a.note}`);
    }
    if (!onboardingComplete && onboardingStarted)
      needsAttention.push(`Onboarding ${progress.percent}% complete`);

    // The single action that would move the score most: the applicable area
    // with the largest weighted deficit.
    const worst = scored
      .slice()
      .sort(
        (a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score),
      )[0];
    const nextStep =
      !assessed || !worst || worst.score >= 90
        ? null
        : {
            label: worst.covered
              ? `Improve ${worst.label} to raise your Business Confidence Score.`
              : `Complete the ${worst.label} module to improve your Business Confidence Score.`,
            href: worst.href,
          };

    return {
      assessed,
      score,
      statusLabel,
      onboarding,
      areas,
      metrics: {
        overdueObligations: overdueObligations.length,
        actionRequired: actionRequired.length,
        openRisks: openRisks.length,
        criticalHighRisks: critical.length + high.length,
        peopleGaps: rtwGaps.length + trainingGaps.length,
        expiringContracts: expiring.length,
      },
      priorities: priorities.slice(0, 6),
      strengths: strengths.slice(0, 6),
      needsAttention: needsAttention.slice(0, 6),
      nextStep,
    };
  });
}
