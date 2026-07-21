import type {
  AcademyAssignment,
  AcademyCertificate,
  AcademyProgress,
  AcademyQuizAttempt,
  CoreDataState,
  Employee,
  LearnerId,
} from "./types";
import { COURSES, getCourse } from "./academy-catalog";
import type { Course } from "./academy-catalog";

export interface Learner {
  id: LearnerId;
  name: string;
  role: string;
  employment_type:
    "owner" | "employee" | "contractor" | "consultant" | "intern";
  employee?: Employee;
}

export function listLearners(state: CoreDataState): Learner[] {
  const owner: Learner = {
    id: "owner",
    name: state.business.owner,
    role: "Business owner",
    employment_type: "owner",
  };
  const staff: Learner[] = state.employees
    .filter((e) => e.employment_status !== "archived")
    .map((e) => ({
      id: e.id,
      name: e.full_name,
      role: e.job_title,
      employment_type: e.employment_type,
      employee: e,
    }));
  return [owner, ...staff];
}

export function findLearner(
  state: CoreDataState,
  id: LearnerId,
): Learner | null {
  return listLearners(state).find((l) => l.id === id) ?? null;
}

export function progressFor(
  state: CoreDataState,
  learner: LearnerId,
  courseId: string,
): AcademyProgress | null {
  return (
    state.academy_progress.find(
      (p) => p.learner_id === learner && p.course_id === courseId,
    ) ?? null
  );
}

export function bestAttempt(
  state: CoreDataState,
  learner: LearnerId,
  courseId: string,
): AcademyQuizAttempt | null {
  const list = state.academy_quiz_attempts
    .filter((a) => a.learner_id === learner && a.course_id === courseId)
    .sort((a, b) => b.score - a.score);
  return list[0] ?? null;
}

export function certificateFor(
  state: CoreDataState,
  learner: LearnerId,
  courseId: string,
): AcademyCertificate | null {
  return (
    state.academy_certificates.find(
      (c) => c.learner_id === learner && c.course_id === courseId,
    ) ?? null
  );
}

export function courseCompletionPct(
  course: Course,
  progress: AcademyProgress | null,
): number {
  if (!progress) return 0;
  const totalLessons = course.lessons.length;
  if (totalLessons === 0) return 0;
  return Math.round((progress.lessons_completed.length / totalLessons) * 100);
}

export function assignmentStatus(
  a: AcademyAssignment,
): AcademyAssignment["status"] {
  if (a.status === "completed") return "completed";
  if (a.due_date && new Date(a.due_date).getTime() < Date.now())
    return "overdue";
  return a.status;
}

export function isAssignmentOverdue(a: AcademyAssignment): boolean {
  return (
    a.status !== "completed" &&
    !!a.due_date &&
    new Date(a.due_date).getTime() < Date.now()
  );
}

export function isDueSoon(a: AcademyAssignment, days = 14): boolean {
  if (a.status === "completed" || !a.due_date) return false;
  const t = new Date(a.due_date).getTime();
  const now = Date.now();
  return t >= now && t - now <= days * 86400000;
}

export interface Recommendation {
  course_id: string;
  priority: "high" | "medium" | "low";
  reason: string;
  source_module: string;
}

export function buildRecommendations(state: CoreDataState): Recommendation[] {
  const out: Recommendation[] = [];
  const push = (
    course_id: string,
    priority: "high" | "medium" | "low",
    reason: string,
    source_module: string,
  ) => {
    if (out.some((r) => r.course_id === course_id)) return;
    out.push({ course_id, priority, reason, source_module });
  };

  // GDPR / privacy
  const privacyStale = state.privacy_notices.every((n) => {
    if (!n.review_date) return true;
    return new Date(n.review_date).getTime() < Date.now();
  });
  const openBreach = state.data_breaches.some((b) => b.status === "open");
  if (privacyStale || state.privacy_notices.length === 0) {
    push(
      "crs_privacy_notice",
      "high",
      "Your privacy notice is missing a current review date.",
      "gdpr",
    );
  }
  if (
    state.data_requests.some(
      (r) => r.status !== "completed" && r.status !== "closed",
    )
  ) {
    push(
      "crs_gdpr_essentials",
      "medium",
      "Open data-subject request recorded in GDPR.",
      "gdpr",
    );
  }
  if (openBreach) {
    push(
      "crs_breach_response",
      "high",
      "Open personal data breach recorded - refresh breach response basics.",
      "gdpr",
    );
  }

  // Right to work
  if (state.employees.some((e) => e.right_to_work_status === "outstanding")) {
    push(
      "crs_rtw",
      "high",
      "One or more right-to-work checks are outstanding in HR.",
      "hr",
    );
  }

  // Info sec / cyber policy status
  const infosec = state.evidence_library_items.find(
    (e) => e.category === "cyber_security",
  );
  if (infosec && infosec.status !== "current") {
    push(
      "crs_cyber_essentials",
      "high",
      "Information Security Policy is not current - review evidence.",
      "risk",
    );
  } else if (
    state.risks.some((r) => r.risk_category === "cyber" && r.status === "open")
  ) {
    push(
      "crs_cyber_essentials",
      "medium",
      "Open cyber risk on the register.",
      "risk",
    );
  }

  // Governance
  if (
    state.governance_records.some(
      (g) => g.status === "pending" || g.approval_status === "unapproved",
    )
  ) {
    push(
      "crs_director_duties",
      "medium",
      "Governance records awaiting sign-off.",
      "governance",
    );
  }

  // Risk
  if (
    state.risks.some(
      (r) =>
        r.status === "open" &&
        (r.residual_rating === "high" || r.residual_rating === "critical"),
    )
  ) {
    push(
      "crs_risk_mgmt",
      "high",
      "High or critical residual risks on the register.",
      "risk",
    );
  }

  // Contracts
  if (
    state.contracts.some(
      (c) =>
        c.status === "active" &&
        c.end_date &&
        new Date(c.end_date).getTime() - Date.now() < 90 * 86400000,
    )
  ) {
    push(
      "crs_contract_mgmt",
      "medium",
      "Contract renewals approaching in the next 90 days.",
      "contracts",
    );
  }

  // Contractors / IR35
  if (state.employees.some((e) => e.employment_type === "contractor")) {
    push(
      "crs_ir35",
      "medium",
      "Contractors on the register - refresh IR35 awareness.",
      "hr",
    );
  }

  // H&S policy
  const hs = state.evidence_library_items.find(
    (e) => e.category === "health_safety",
  );
  if (hs && hs.status !== "current") {
    push(
      "crs_hs",
      "medium",
      "Health & safety policy is not current.",
      "governance",
    );
  } else if (state.business_profile.employee_count >= 5) {
    push(
      "crs_hs",
      "low",
      "Employer with 5+ employees - H&S policy required by law.",
      "governance",
    );
  }

  // Tender evidence
  const tenderReqIncomplete = state.tender_requirements.some(
    (r) => r.status !== "complete" && r.status !== "not_applicable",
  );
  if (tenderReqIncomplete) {
    push(
      "crs_tender_evidence",
      "medium",
      "Tender requirements incomplete on active opportunities.",
      "tender-ready",
    );
  }

  // Investor readiness
  const investorGaps = state.due_diligence_items.some(
    (i) => i.status === "missing" || i.status === "needs_review",
  );
  if (investorGaps) {
    push(
      "crs_investor_dd",
      "medium",
      "Missing or unreviewed due-diligence items.",
      "investor-ready",
    );
  }

  return out;
}

export interface AcademyMetrics {
  totalAssignments: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  certificatesEarned: number;
  recommendedCount: number;
  peopleWithGaps: number;
  learningMinutes: number;
  overallProgressPct: number;
}

export function academyMetrics(state: CoreDataState): AcademyMetrics {
  const assignments = state.academy_assignments;
  const inProgress = assignments.filter(
    (a) => assignmentStatus(a) === "in_progress",
  ).length;
  const completed = assignments.filter((a) => a.status === "completed").length;
  const overdue = assignments.filter(isAssignmentOverdue).length;
  const dueSoon = assignments.filter((a) => isDueSoon(a)).length;
  const certificates = state.academy_certificates.length;
  const learners = listLearners(state);
  const peopleWithGaps = learners.filter((l) =>
    assignments.some((a) => a.learner_id === l.id && a.status !== "completed"),
  ).length;
  const minutes = state.academy_progress.reduce(
    (s, p) => s + p.time_minutes,
    0,
  );
  const totalLessonsAssigned = assignments.reduce((s, a) => {
    const c = getCourse(a.course_id);
    return s + (c ? c.lessons.length : 0);
  }, 0);
  const totalCompleted = assignments.reduce((s, a) => {
    const c = getCourse(a.course_id);
    if (!c) return s;
    const p = progressFor(state, a.learner_id, a.course_id);
    return s + (p ? p.lessons_completed.length : 0);
  }, 0);
  const overallProgressPct =
    totalLessonsAssigned === 0
      ? 0
      : Math.round((totalCompleted / totalLessonsAssigned) * 100);
  const recommendedCount = buildRecommendations(state).length;
  return {
    totalAssignments: assignments.length,
    inProgress,
    completed,
    overdue,
    dueSoon,
    certificatesEarned: certificates,
    recommendedCount,
    peopleWithGaps,
    learningMinutes: minutes,
    overallProgressPct,
  };
}

export function findNextIncompleteLessonIndex(
  course: Course,
  progress: AcademyProgress | null,
): number {
  if (!progress) return 0;
  for (let i = 0; i < course.lessons.length; i++) {
    if (!progress.lessons_completed.includes(course.lessons[i].id)) return i;
  }
  return course.lessons.length - 1;
}

export function certificateReference(courseId: string, seq: number): string {
  const code = courseId
    .replace(/^crs_/, "")
    .split("_")[0]
    .toUpperCase()
    .slice(0, 6);
  const year = new Date().getFullYear();
  return `JOAC-${code}-${year}-${String(seq).padStart(4, "0")}`;
}

export const CATEGORY_LIST = Array.from(
  new Set(COURSES.map((c) => c.category)),
).sort();
