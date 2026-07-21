import { isNull } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  academyAssignments,
  businessProfiles,
  complianceObligations,
  contracts,
  employees,
  governanceRecords,
  processingActivities,
  risks,
} from "../db/schema";
import { getCourse } from "../../data/academy-catalog";

// Jova - the deterministic intelligence layer. It runs the workspace's live
// data through a fixed set of rules and emits explained, prioritised findings.
// No LLM: every finding here is reproducible from the data (the Phase-2 AI
// assistant will sit on top of this, not replace it). One withUser()
// transaction, RLS-scoped to the caller's workspace.

export type Severity = "critical" | "high" | "medium" | "low";

export interface JovaFinding {
  id: string;
  severity: Severity;
  module: string;
  href: string;
  title: string;
  explanation: string;
  action: string;
}

export interface JovaBriefing {
  generatedFor: string; // YYYY-MM-DD
  total: number;
  counts: Record<Severity, number>;
  findings: JovaFinding[];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function getJovaBriefing(claims: UserClaims): Promise<JovaBriefing> {
  return withUser(claims, async (tx) => {
    const [obs, rsk, emp, con, roc, gov, aca, prof] = await Promise.all([
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
          endDate: contracts.endDate,
          renewalDate: contracts.renewalDate,
        })
        .from(contracts)
        .where(isNull(contracts.deletedAt)),
      tx
        .select({
          id: processingActivities.id,
          name: processingActivities.activityName,
          status: processingActivities.status,
          special: processingActivities.specialCategoryData,
          reviewDate: processingActivities.reviewDate,
        })
        .from(processingActivities),
      tx
        .select({
          id: governanceRecords.id,
          title: governanceRecords.title,
          status: governanceRecords.status,
        })
        .from(governanceRecords),
      tx
        .select({
          id: academyAssignments.id,
          courseId: academyAssignments.courseId,
          status: academyAssignments.status,
          legallyRequired: academyAssignments.legallyRequired,
          dueDate: academyAssignments.dueDate,
        })
        .from(academyAssignments),
      tx
        .select({ completion: businessProfiles.profileCompletion })
        .from(businessProfiles)
        .limit(1),
    ]);

    const t = today();
    const soon = addDays(60);
    const findings: JovaFinding[] = [];
    const add = (f: JovaFinding) => findings.push(f);

    // --- Compliance -----------------------------------------------------------
    for (const o of obs) {
      const overdue =
        o.status === "overdue" ||
        (!!o.dueDate &&
          o.dueDate < t &&
          o.status !== "completed" &&
          o.status !== "not_applicable");
      if (overdue) {
        add({
          id: `ob-${o.id}`,
          severity: "high",
          module: "Compliance",
          href: "/compliance",
          title: `Overdue: ${o.title}`,
          explanation:
            "This statutory or regulatory obligation has passed its due date and is not marked complete.",
          action: "Complete it, or mark it not applicable with a reason.",
        });
      } else if (o.status === "action_required") {
        add({
          id: `ob-${o.id}`,
          severity: "medium",
          module: "Compliance",
          href: "/compliance",
          title: `Action required: ${o.title}`,
          explanation: "This obligation needs work before its deadline.",
          action: "Review what's required and record the evidence.",
        });
      }
    }

    // --- Risk -----------------------------------------------------------------
    for (const r of rsk) {
      if (r.status !== "open") continue;
      if (r.residual === "critical" || r.residual === "high") {
        add({
          id: `rk-${r.id}`,
          severity: r.residual === "critical" ? "critical" : "high",
          module: "Risk",
          href: "/risk",
          title: `${r.residual === "critical" ? "Critical" : "High"} risk: ${r.title}`,
          explanation: `This open risk has a ${r.residual} residual rating after controls.`,
          action: "Add or strengthen controls, or formally accept the risk.",
        });
      }
    }

    // --- People (HR) ----------------------------------------------------------
    for (const e of emp) {
      if (e.status === "archived") continue;
      if (e.rtw === "outstanding" || e.rtw === "expired") {
        add({
          id: `hr-rtw-${e.id}`,
          severity: "high",
          module: "HR",
          href: "/hr",
          title: `Right to work ${e.rtw}: ${e.name}`,
          explanation:
            "Employing someone without a valid right-to-work check is an illegal-working exposure with civil penalties.",
          action: "Complete and record the right-to-work check.",
        });
      }
      if (e.training === "overdue" || e.training === "outstanding") {
        add({
          id: `hr-tr-${e.id}`,
          severity: e.training === "overdue" ? "medium" : "low",
          module: "HR",
          href: "/hr",
          title: `Training ${e.training}: ${e.name}`,
          explanation: "Required training is not yet complete for this person.",
          action: "Assign or chase the outstanding training.",
        });
      }
    }

    // --- Contracts ------------------------------------------------------------
    for (const c of con) {
      if (c.status === "archived") continue;
      if (c.status === "expired") {
        add({
          id: `co-${c.id}`,
          severity: "medium",
          module: "Contracts",
          href: "/contracts",
          title: `Expired: ${c.title}`,
          explanation: "This contract is marked expired but not archived.",
          action: "Renew, replace, or archive it.",
        });
        continue;
      }
      const renews =
        (c.endDate && c.endDate >= t && c.endDate <= soon) ||
        (c.renewalDate && c.renewalDate >= t && c.renewalDate <= soon);
      if (renews) {
        add({
          id: `co-${c.id}`,
          severity: "low",
          module: "Contracts",
          href: "/contracts",
          title: `Renewal due soon: ${c.title}`,
          explanation:
            "This contract has an end or renewal date within the next 60 days.",
          action:
            "Decide whether to renew, renegotiate or exit before the date.",
        });
      }
    }

    // --- GDPR -----------------------------------------------------------------
    for (const a of roc) {
      if (a.status === "active" && a.special && !a.reviewDate) {
        add({
          id: `pa-${a.id}`,
          severity: "high",
          module: "GDPR",
          href: "/gdpr",
          title: `Unreviewed special-category data: ${a.name}`,
          explanation:
            "This activity processes special-category data but has no review date set - higher-risk processing needs periodic review.",
          action: "Review the activity and set a review date.",
        });
      }
    }

    // --- Governance -----------------------------------------------------------
    for (const g of gov) {
      if (g.status === "draft" || g.status === "pending") {
        add({
          id: `gv-${g.id}`,
          severity: "low",
          module: "Governance",
          href: "/governance",
          title: `Awaiting approval: ${g.title}`,
          explanation: "This governance record has not been approved.",
          action: "Review and approve, or record the decision.",
        });
      }
    }

    // --- Academy --------------------------------------------------------------
    for (const a of aca) {
      const done = a.status === "completed";
      if (done) continue;
      const overdue = a.status === "overdue" || (!!a.dueDate && a.dueDate < t);
      if (a.legallyRequired || overdue) {
        add({
          id: `ac-${a.id}`,
          severity: a.legallyRequired ? "medium" : "low",
          module: "Academy",
          href: "/academy",
          title: `${a.legallyRequired ? "Legally-required" : "Outstanding"} training: ${
            getCourse(a.courseId)?.title ?? a.courseId
          }`,
          explanation: a.legallyRequired
            ? "This course is marked legally required and is not yet complete."
            : "This assigned course is overdue.",
          action: "Complete the course to keep your learning record current.",
        });
      }
    }

    // --- Profile completeness -------------------------------------------------
    const completion = prof[0]?.completion ?? 0;
    if (completion < 50) {
      add({
        id: "profile-incomplete",
        severity: "low",
        module: "Settings",
        href: "/settings",
        title: "Business profile is incomplete",
        explanation: `Your profile is ${completion}% complete. Jova and your Confidence Score are more accurate with a full profile.`,
        action: "Fill in the remaining business-profile fields.",
      });
    }

    findings.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );

    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const f of findings) counts[f.severity]++;

    return {
      generatedFor: t,
      total: findings.length,
      counts,
      findings,
    };
  });
}
