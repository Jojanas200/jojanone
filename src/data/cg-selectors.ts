import type { CoreDataState, Risk, ComplianceObligation } from "./types";

const DAY = 86400000;

export function obligationMetrics(s: CoreDataState) {
  const now = Date.now();
  const applicable = s.compliance_obligations.filter(
    (o) => o.applicability_status === "applicable",
  );
  const overdue = applicable.filter(
    (o) =>
      o.status !== "completed" &&
      o.due_date &&
      new Date(o.due_date).getTime() < now,
  );
  const due30 = applicable.filter(
    (o) =>
      o.status !== "completed" &&
      o.due_date &&
      new Date(o.due_date).getTime() >= now &&
      new Date(o.due_date).getTime() - now <= 30 * DAY,
  );
  const actionRequired = applicable.filter(
    (o) => o.status === "action_required" || o.status === "overdue",
  );
  const awaitingEvidence = applicable.filter(
    (o) => o.evidence_status !== "complete" && o.status !== "completed",
  );
  const completedMonth = s.compliance_obligations.filter((o) => {
    if (!o.completed_at) return false;
    const d = new Date(o.completed_at);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  });
  const na = s.compliance_obligations.filter(
    (o) => o.applicability_status === "not_applicable",
  );
  return {
    applicable,
    overdue,
    due30,
    actionRequired,
    awaitingEvidence,
    completedMonth,
    na,
  };
}

export function gdprMetrics(s: CoreDataState) {
  const latest = s.gdpr_assessments[0];
  const openRequests = s.data_requests.filter(
    (r) => r.status === "open" || r.status === "in_progress",
  );
  const openBreaches = s.data_breaches.filter((b) => b.status !== "closed");
  const dpiaReview = s.dpias.filter(
    (d) =>
      d.status === "draft" ||
      (d.review_date && new Date(d.review_date).getTime() < Date.now()),
  );
  const notice = s.privacy_notices[0];
  const noticeOutdated = notice
    ? new Date(notice.review_date ?? notice.updated_at).getTime() < Date.now()
    : true;
  const ico = s.compliance_obligations.find((o) => o.id === "obl_ico_fee");
  return {
    readiness: latest?.score ?? 0,
    gaps: latest?.gaps ?? [],
    processing: s.processing_activities.filter((p) => p.status === "active")
      .length,
    openRequests,
    openBreaches,
    dpiaReview,
    noticeOutdated,
    ico,
  };
}

export function governanceMetrics(s: CoreDataState) {
  const now = Date.now();
  const pending = s.governance_records.filter(
    (g) => g.status === "pending" || g.status === "draft",
  );
  const meetings = s.governance_records.filter(
    (g) =>
      g.record_type === "board_meeting" &&
      g.meeting_date &&
      new Date(g.meeting_date).getTime() >= now,
  );
  const minutesPending = s.governance_records.filter(
    (g) =>
      g.record_type === "meeting_minutes" && g.approval_status !== "approved",
  );
  const policiesDue = s.policies.filter(
    (p) =>
      p.status !== "archived" &&
      p.review_date &&
      new Date(p.review_date).getTime() < now + 30 * DAY,
  );
  const completedQuarter = s.governance_records.filter((g) => {
    if (!g.decision_date || g.status !== "approved") return false;
    return new Date(g.decision_date).getTime() > now - 90 * DAY;
  });
  return { pending, meetings, minutesPending, policiesDue, completedQuarter };
}

export function riskMetrics(s: CoreDataState) {
  const now = Date.now();
  const open = s.risks.filter((r) => r.status === "open");
  const highInherent = open.filter(
    (r) => r.inherent_rating === "high" || r.inherent_rating === "critical",
  );
  const highResidual = open.filter(
    (r) => r.residual_rating === "high" || r.residual_rating === "critical",
  );
  const overdueReview = open.filter(
    (r) => r.review_date && new Date(r.review_date).getTime() < now,
  );
  const overdueMit = open.flatMap((r) =>
    r.mitigation_actions
      .filter(
        (m) =>
          m.status === "open" &&
          m.due_date &&
          new Date(m.due_date).getTime() < now,
      )
      .map((m) => ({ risk: r, mit: m })),
  );
  const accepted = s.risks.filter((r) => r.status === "accepted");
  const closedMonth = s.risks.filter((r) => {
    if (!r.closed_at) return false;
    const d = new Date(r.closed_at);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  });
  return {
    open,
    highInherent,
    highResidual,
    overdueReview,
    overdueMit,
    accepted,
    closedMonth,
  };
}

export function deriveAreaScores(s: CoreDataState) {
  const om = obligationMetrics(s);
  const gm = gdprMetrics(s);
  const govm = governanceMetrics(s);
  const rm = riskMetrics(s);
  const complianceScore = Math.max(
    30,
    100 -
      om.overdue.length * 12 -
      om.actionRequired.length * 4 -
      om.awaitingEvidence.length * 2,
  );
  const gdprScore = gm.readiness || 70;
  const governanceScore = Math.max(
    40,
    100 -
      govm.minutesPending.length * 6 -
      govm.policiesDue.length * 4 -
      govm.pending.length * 3,
  );
  const riskScore = Math.max(
    30,
    100 -
      rm.highResidual.length * 10 -
      rm.overdueReview.length * 5 -
      rm.overdueMit.length * 3,
  );
  return {
    complianceScore,
    gdprScore,
    governanceScore,
    riskScore,
    om,
    gm,
    govm,
    rm,
  };
}

export function riskRatingColor(rating: Risk["residual_rating"]) {
  if (rating === "critical")
    return "bg-[oklch(0.94_0.09_25)] text-[oklch(0.5_0.2_25)]";
  if (rating === "high")
    return "bg-[oklch(0.95_0.05_25)] text-[oklch(0.5_0.2_25)]";
  if (rating === "medium")
    return "bg-[oklch(0.96_0.08_85)] text-[oklch(0.45_0.15_75)]";
  return "bg-[oklch(0.95_0.06_148)] text-[oklch(0.42_0.15_148)]";
}

export function obligationStatusLabel(o: ComplianceObligation): string {
  if (o.status === "completed") return "Completed";
  if (o.status === "not_applicable") return "Not applicable";
  if (o.due_date && new Date(o.due_date).getTime() < Date.now())
    return "Overdue";
  if (o.status === "action_required") return "Action required";
  if (o.status === "in_progress") return "In progress";
  return "Upcoming";
}
