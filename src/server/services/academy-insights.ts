import { type UserClaims } from "../db";
import { getCourse } from "../../data/academy-catalog";
import { listAssignments, listCertificates } from "./academy";
import { listEmployees } from "./hr";
import { listRisks } from "./risk";
import { listContracts } from "./contracts";
import { listGovernanceRecords } from "./governance";
import { listTenderOpportunities } from "./tender";
import { listProcessingActivities } from "./gdpr";
import {
  getGdprAssessment,
  listDataBreaches,
  listPrivacyNotices,
} from "./gdpr-registers";
import { getReadinessAssessment } from "./investor-readiness";

export interface CourseRecommendation {
  courseId: string;
  title: string;
  priority: "high" | "medium";
  reason: string;
  sourceModule: string;
  assigned: boolean;
}

const ACTIVE_TENDER = new Set([
  "identified",
  "assessing",
  "bid",
  "drafting",
  "review",
  "submitted",
]);

/**
 * Deterministic course recommendations from the workspace's live records.
 * Mirrors the prototype's recommendation engine: each rule names the signal it
 * fired on, so every suggestion is explainable. Certificated courses are
 * excluded; already-assigned ones are flagged.
 */
export async function buildCourseRecommendations(
  claims: UserClaims,
): Promise<CourseRecommendation[]> {
  const [
    assignments,
    certificates,
    employees,
    risks,
    contracts,
    governance,
    tenders,
    activities,
    gdpr,
    breaches,
    notices,
    investor,
  ] = await Promise.all([
    listAssignments(claims),
    listCertificates(claims),
    listEmployees(claims),
    listRisks(claims),
    listContracts(claims),
    listGovernanceRecords(claims),
    listTenderOpportunities(claims),
    listProcessingActivities(claims),
    getGdprAssessment(claims),
    listDataBreaches(claims),
    listPrivacyNotices(claims),
    getReadinessAssessment(claims),
  ]);

  const certified = new Set(certificates.map((c) => c.courseId));
  const assigned = new Set(assignments.map((a) => a.courseId));
  const out: CourseRecommendation[] = [];
  const add = (
    courseId: string,
    priority: "high" | "medium",
    reason: string,
    sourceModule: string,
  ) => {
    if (certified.has(courseId)) return;
    const course = getCourse(courseId);
    if (!course) return;
    out.push({
      courseId,
      title: course.title,
      priority,
      reason,
      sourceModule,
      assigned: assigned.has(courseId),
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  if (!gdpr)
    add(
      "crs_gdpr_essentials",
      "high",
      "No GDPR health check on record yet.",
      "gdpr",
    );
  else if (gdpr.score < 60)
    add(
      "crs_gdpr_essentials",
      "high",
      `GDPR health check sits at ${gdpr.score}/100.`,
      "gdpr",
    );

  if (breaches.some((b) => b.status !== "closed"))
    add(
      "crs_breach_response",
      "high",
      "An open data breach is on the register.",
      "gdpr",
    );

  if (activities.length > 0 && !notices.some((n) => n.status === "published"))
    add(
      "crs_privacy_notice",
      "medium",
      "You process personal data but have no published privacy notice.",
      "gdpr",
    );

  if (activities.length > 0)
    add(
      "crs_cyber_essentials",
      "medium",
      `${activities.length} processing activit${activities.length === 1 ? "y" : "ies"} rely on your technical security.`,
      "gdpr",
    );

  const activeStaff = employees.filter(
    (e) => e.employmentStatus !== "archived",
  );
  const rtwOutstanding = activeStaff.filter(
    (e) => e.rightToWorkStatus !== "verified",
  );
  if (rtwOutstanding.length > 0)
    add(
      "crs_rtw",
      "high",
      `${rtwOutstanding.length} team member${rtwOutstanding.length === 1 ? "" : "s"} without a verified right-to-work check.`,
      "hr",
    );
  if (activeStaff.length > 0)
    add(
      "crs_hs",
      "medium",
      "You employ staff, so health & safety duties apply.",
      "hr",
    );
  if (activeStaff.some((e) => e.employmentType === "contractor"))
    add(
      "crs_ir35",
      "medium",
      "You engage contractors - IR35 status matters.",
      "hr",
    );

  if (
    risks.some(
      (r) =>
        r.status === "open" &&
        (r.residualRating === "high" || r.residualRating === "critical"),
    )
  )
    add(
      "crs_risk_mgmt",
      "medium",
      "Open high or critical risks are on the register.",
      "risk",
    );

  if (governance.length === 0)
    add(
      "crs_director_duties",
      "medium",
      "No governance records yet - decisions are going unrecorded.",
      "governance",
    );

  if (
    contracts.some(
      (c) =>
        c.status === "active" &&
        (!c.endDate || (c.endDate >= today && c.endDate <= in30)),
    )
  )
    add(
      "crs_contract_mgmt",
      "medium",
      "Active contracts are missing end dates or expiring within 30 days.",
      "contracts",
    );

  if (tenders.some((t) => ACTIVE_TENDER.has(t.status)))
    add(
      "crs_tender_evidence",
      "medium",
      "You have live tender opportunities in the pipeline.",
      "tender-ready",
    );

  if (investor)
    add(
      "crs_investor_dd",
      "medium",
      "You are preparing for investment - due diligence will follow.",
      "investor-ready",
    );

  return out
    .sort((a, b) =>
      a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1,
    )
    .slice(0, 6);
}
