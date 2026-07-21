import { isNull } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  complianceObligations,
  contracts,
  employees,
  governanceRecords,
  processingActivities,
  risks,
} from "../db/schema";

// Business Confidence Score - a transparent, penalty-based roll-up across the
// live modules. Each area starts at 100 and loses points for open issues; the
// overall score is a weighted average. Everything runs inside one withUser()
// transaction so it only ever sees the caller's workspace (RLS).

export type StatusLabel = "Good" | "Needs Attention" | "At Risk";

export interface AreaScore {
  key: string;
  label: string;
  href: string;
  score: number;
  weight: number;
  note: string;
}

export interface Snapshot {
  score: number;
  statusLabel: StatusLabel;
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
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function getSnapshot(claims: UserClaims): Promise<Snapshot> {
  return withUser(claims, async (tx) => {
    const [obs, rsk, emp, con, roc, gov] = await Promise.all([
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
    ]);

    const t = today();
    const soon = addDays(60);
    const priorities: { label: string; href: string }[] = [];

    // --- Compliance -----------------------------------------------------------
    const isOverdue = (o: (typeof obs)[number]) =>
      o.status === "overdue" ||
      (!!o.dueDate &&
        o.dueDate < t &&
        o.status !== "completed" &&
        o.status !== "not_applicable");
    const overdueObligations = obs.filter(isOverdue);
    const actionRequired = obs.filter((o) => o.status === "action_required");
    const complianceScore = clamp(
      100 - overdueObligations.length * 12 - actionRequired.length * 6,
    );
    overdueObligations
      .slice(0, 3)
      .forEach((o) =>
        priorities.push({ label: `Overdue: ${o.title}`, href: "/compliance" }),
      );

    // --- Risk -----------------------------------------------------------------
    const openRisks = rsk.filter((r) => r.status === "open");
    const critical = openRisks.filter((r) => r.residual === "critical");
    const high = openRisks.filter((r) => r.residual === "high");
    const medium = openRisks.filter((r) => r.residual === "medium");
    const riskScore = clamp(
      100 - critical.length * 20 - high.length * 10 - medium.length * 3,
    );
    [...critical, ...high]
      .slice(0, 3)
      .forEach((r) =>
        priorities.push({ label: `Mitigate risk: ${r.title}`, href: "/risk" }),
      );

    // --- People (HR) ----------------------------------------------------------
    const active = emp.filter((e) => e.status !== "archived");
    const rtwGaps = active.filter(
      (e) => e.rtw === "outstanding" || e.rtw === "expired",
    );
    const trainingGaps = active.filter(
      (e) => e.training === "overdue" || e.training === "outstanding",
    );
    const peopleScore = clamp(
      100 - rtwGaps.length * 10 - trainingGaps.length * 5,
    );
    rtwGaps
      .slice(0, 2)
      .forEach((e) =>
        priorities.push({ label: `Right-to-work: ${e.name}`, href: "/hr" }),
      );

    // --- Contracts ------------------------------------------------------------
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
      100 -
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

    // --- GDPR -----------------------------------------------------------------
    const activeRopa = roc.filter((a) => a.status === "active");
    const specialNoReview = activeRopa.filter(
      (a) => a.special && !a.reviewDate,
    );
    const gdprScore = clamp(100 - specialNoReview.length * 8);

    // --- Governance -----------------------------------------------------------
    const pendingGov = gov.filter(
      (g) => g.status === "draft" || g.status === "pending",
    );
    const governanceScore = clamp(100 - pendingGov.length * 4);

    const areas: AreaScore[] = [
      {
        key: "compliance",
        label: "Compliance",
        href: "/compliance",
        score: complianceScore,
        weight: 25,
        note: `${overdueObligations.length} overdue, ${actionRequired.length} action required`,
      },
      {
        key: "risk",
        label: "Risk",
        href: "/risk",
        score: riskScore,
        weight: 25,
        note: `${critical.length} critical, ${high.length} high (open)`,
      },
      {
        key: "people",
        label: "People",
        href: "/hr",
        score: peopleScore,
        weight: 15,
        note: `${rtwGaps.length} RTW gaps, ${trainingGaps.length} training gaps`,
      },
      {
        key: "contracts",
        label: "Contracts",
        href: "/contracts",
        score: contractsScore,
        weight: 15,
        note: `${expiring.length} expiring soon, ${expired.length} expired`,
      },
      {
        key: "gdpr",
        label: "Data protection",
        href: "/gdpr",
        score: gdprScore,
        weight: 10,
        note: `${activeRopa.length} activities, ${specialNoReview.length} special-category unreviewed`,
      },
      {
        key: "governance",
        label: "Governance",
        href: "/governance",
        score: governanceScore,
        weight: 10,
        note: `${pendingGov.length} awaiting approval`,
      },
    ];

    const totalWeight = areas.reduce((s, a) => s + a.weight, 0);
    const score = clamp(
      areas.reduce((s, a) => s + a.score * a.weight, 0) / totalWeight,
    );
    const statusLabel: StatusLabel =
      score >= 80 ? "Good" : score >= 60 ? "Needs Attention" : "At Risk";

    return {
      score,
      statusLabel,
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
    };
  });
}
