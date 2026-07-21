import type {
  CoreDataState,
  DueDiligenceItem,
  DDCategory,
  InvestorReadinessAssessment,
  TenderRequirement,
} from "./types";

const DAY = 86400000;

const DD_CATEGORIES: DDCategory[] = [
  "corporate",
  "financial",
  "legal",
  "compliance",
  "commercial",
  "people",
  "data_room",
];

export function ddScoreForCategory(
  items: DueDiligenceItem[],
  category: DDCategory | "all",
): number {
  const list =
    category === "all" ? items : items.filter((i) => i.category === category);
  if (list.length === 0) return 0;
  const total = list.reduce((sum, i) => {
    if (i.status === "ready") return sum + 100;
    if (i.status === "not_applicable") return sum + 100;
    if (i.status === "needs_review") return sum + 70;
    if (i.status === "in_progress") return sum + 40;
    return sum;
  }, 0);
  return Math.round(total / list.length);
}

export function investorReadinessMetrics(s: CoreDataState) {
  const items = s.due_diligence_items;
  const categoryScores = Object.fromEntries(
    DD_CATEGORIES.map((c) => [c, ddScoreForCategory(items, c)]),
  ) as Record<DDCategory, number>;
  const overallScore =
    DD_CATEGORIES.length === 0
      ? 0
      : Math.round(
          DD_CATEGORIES.reduce((sum, c) => sum + categoryScores[c], 0) /
            DD_CATEGORIES.length,
        );
  const ready = items.filter((i) => i.status === "ready").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const needsReview = items.filter((i) => i.status === "needs_review").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const highPriorityGaps = items.filter(
    (i) =>
      i.priority === "high" &&
      (i.status === "missing" || i.status === "needs_review"),
  );
  const redFlags = items
    .filter(
      (i) => i.priority === "high" && i.status === "missing" && i.required,
    )
    .map((i) => i.title);
  const openActions = items.filter(
    (i) =>
      i.status === "missing" ||
      i.status === "needs_review" ||
      i.status === "in_progress",
  );
  const dataRoomTotal = s.data_room_items.length;
  const dataRoomReady = s.data_room_items.filter(
    (d) => d.status === "ready",
  ).length;
  const dataRoomComplete =
    dataRoomTotal === 0 ? 0 : Math.round((dataRoomReady / dataRoomTotal) * 100);
  return {
    items,
    categoryScores,
    overallScore,
    ready,
    missing,
    needsReview,
    inProgress,
    highPriorityGaps,
    redFlags,
    openActions,
    dataRoomTotal,
    dataRoomReady,
    dataRoomComplete,
  };
}

export function categoryLabel(c: DDCategory): string {
  return (
    {
      corporate: "Corporate",
      financial: "Financial",
      legal: "Legal",
      compliance: "Compliance",
      commercial: "Commercial",
      people: "People",
      data_room: "Data room",
    } as Record<DDCategory, string>
  )[c];
}

export function ddStatusLabel(s: DueDiligenceItem["status"]): string {
  return (
    {
      missing: "Missing",
      in_progress: "In progress",
      ready: "Ready",
      needs_review: "Needs review",
      not_applicable: "Not applicable",
    } as Record<DueDiligenceItem["status"], string>
  )[s];
}

export function tenderReadinessMetrics(s: CoreDataState) {
  const now = Date.now();
  const opportunities = s.tender_opportunities.filter(
    (o) => o.status !== "archived",
  );
  const active = opportunities.filter((o) =>
    ["assessing", "bid", "drafting", "review"].includes(o.status),
  );
  const bidPending = opportunities.filter((o) => o.status === "assessing");
  const upcomingDeadlines = opportunities.filter(
    (o) =>
      o.submission_deadline &&
      new Date(o.submission_deadline).getTime() >= now &&
      new Date(o.submission_deadline).getTime() - now <= 30 * DAY,
  );
  const submitted = opportunities.filter(
    (o) =>
      o.status === "submitted" || o.status === "won" || o.status === "lost",
  );
  const activeOppIds = new Set(active.map((o) => o.id));
  const requirements = s.tender_requirements.filter((r) =>
    activeOppIds.has(r.opportunity_id),
  );
  const requirementsIncomplete = requirements.filter(
    (r) => r.status !== "complete" && r.status !== "not_applicable",
  );
  const evidenceMissing = requirements.filter(
    (r) => r.status === "evidence_missing",
  );
  const responses = s.tender_responses.filter((r) =>
    activeOppIds.has(r.opportunity_id),
  );
  const responsesForReview = responses.filter(
    (r) => r.status === "ready_for_review",
  );

  const policies = s.policies.filter((p) => p.status === "active");
  const evidenceItems = s.evidence_library_items.filter(
    (e) => e.status === "current",
  );
  const policyScore = Math.min(100, policies.length * 12);
  const evidenceScore = Math.min(100, evidenceItems.length * 8);
  const insuranceOk = s.evidence_library_items.some(
    (e) => e.category === "insurance" && e.status === "current",
  );
  const gdprOk =
    (s.gdpr_assessments[0]?.score ?? 0) >= 70 ||
    s.processing_activities.some((p) => p.status === "active");
  const complianceOk =
    s.compliance_obligations.filter(
      (o) =>
        o.status !== "completed" &&
        o.due_date &&
        new Date(o.due_date).getTime() < now,
    ).length === 0;
  const baseline =
    40 + (insuranceOk ? 15 : 0) + (gdprOk ? 15 : 0) + (complianceOk ? 15 : 0);
  const readinessScore = Math.min(
    100,
    Math.round(policyScore * 0.3 + evidenceScore * 0.3 + baseline * 0.4),
  );

  return {
    opportunities,
    active,
    bidPending,
    upcomingDeadlines,
    submitted,
    requirements,
    requirementsIncomplete,
    evidenceMissing,
    responses,
    responsesForReview,
    readinessScore,
    policyScore,
    evidenceScore,
    insuranceOk,
    gdprOk,
    complianceOk,
  };
}

export function submissionChecklistItems(
  s: CoreDataState,
  opportunityId: string,
) {
  const opp = s.tender_opportunities.find((o) => o.id === opportunityId);
  const reqs = s.tender_requirements.filter(
    (r) => r.opportunity_id === opportunityId,
  );
  const mandatoryDone =
    reqs.filter((r) => r.mandatory).length === 0 ||
    reqs
      .filter((r) => r.mandatory)
      .every((r) => r.status === "complete" || r.status === "not_applicable");
  const allDone =
    reqs.length === 0 ||
    reqs.every((r) => r.status === "complete" || r.status === "not_applicable");
  const responses = s.tender_responses.filter(
    (r) => r.opportunity_id === opportunityId,
  );
  const allApproved =
    responses.length > 0 && responses.every((r) => r.status === "approved");
  const hasEvidence = reqs
    .filter((r) => r.mandatory)
    .every((r) => r.evidence_reference !== "");
  const wordOk = responses.every(
    (r) =>
      !r.word_limit ||
      r.response_text.split(/\s+/).filter(Boolean).length <= r.word_limit,
  );
  const notPastDeadline = opp?.submission_deadline
    ? new Date(opp.submission_deadline).getTime() > Date.now()
    : true;
  const hasCommercial = reqs.some(
    (r) => r.requirement_type === "commercial" && r.status === "complete",
  );
  const legalDone = reqs
    .filter((r) => r.requirement_type === "legal")
    .every((r) => r.status === "complete" || r.status === "not_applicable");
  return [
    {
      id: "elig",
      label: "Eligibility confirmed",
      done: mandatoryDone,
      mandatory: true,
    },
    {
      id: "mand",
      label: "Mandatory requirements complete",
      done: mandatoryDone,
      mandatory: true,
    },
    {
      id: "all_q",
      label: "All questions answered",
      done: allDone,
      mandatory: true,
    },
    {
      id: "words",
      label: "Word limits checked",
      done: wordOk,
      mandatory: true,
    },
    {
      id: "evi",
      label: "Evidence attached to mandatory requirements",
      done: hasEvidence,
      mandatory: true,
    },
    {
      id: "price",
      label: "Pricing completed",
      done: hasCommercial,
      mandatory: true,
    },
    {
      id: "decl",
      label: "Declarations completed",
      done: legalDone,
      mandatory: true,
    },
    {
      id: "approval",
      label: "Internal approval recorded (responses approved)",
      done: allApproved,
      mandatory: true,
    },
    {
      id: "files",
      label: "File names checked",
      done: allApproved,
      mandatory: false,
    },
    {
      id: "portal",
      label: "Submission portal details recorded",
      done: (opp?.source ?? "") !== "",
      mandatory: false,
    },
    {
      id: "deadline",
      label: "Deadline confirmed",
      done: notPastDeadline,
      mandatory: true,
    },
    {
      id: "receipt",
      label: "Submission receipt recorded",
      done:
        opp?.status === "submitted" ||
        opp?.status === "won" ||
        opp?.status === "lost",
      mandatory: false,
    },
  ];
}

export function reqTypeLabel(t: TenderRequirement["requirement_type"]): string {
  return (
    {
      eligibility: "Eligibility",
      pass_fail: "Pass / fail",
      technical: "Technical",
      quality: "Quality",
      commercial: "Commercial",
      social_value: "Social value",
      legal: "Legal",
      submission: "Submission",
    } as Record<TenderRequirement["requirement_type"], string>
  )[t];
}

export function reqStatusLabel(s: TenderRequirement["status"]): string {
  return (
    {
      not_started: "Not started",
      in_progress: "In progress",
      evidence_missing: "Evidence missing",
      ready_for_review: "Ready for review",
      complete: "Complete",
      not_applicable: "Not applicable",
    } as Record<TenderRequirement["status"], string>
  )[s];
}

export function computeReadinessAssessment(
  s: CoreDataState,
): Omit<
  InvestorReadinessAssessment,
  | "id"
  | "business_id"
  | "created_at"
  | "updated_at"
  | "answers"
  | "status"
  | "completed_at"
  | "review_date"
> {
  const m = investorReadinessMetrics(s);
  const gaps = m.items
    .filter((i) => i.status === "missing" || i.status === "needs_review")
    .map((i) => `${categoryLabel(i.category)}: ${i.title}`);
  const recommended_actions = m.items
    .filter((i) => i.status !== "ready" && i.status !== "not_applicable")
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    )
    .slice(0, 8)
    .map((i) => ({
      label: `Resolve: ${i.title}`,
      category: i.category,
      priority: i.priority,
    }));
  return {
    overall_score: m.overallScore,
    corporate_score: m.categoryScores.corporate,
    financial_score: m.categoryScores.financial,
    legal_score: m.categoryScores.legal,
    compliance_score: m.categoryScores.compliance,
    commercial_score: m.categoryScores.commercial,
    people_score: m.categoryScores.people,
    data_room_score: m.categoryScores.data_room,
    gaps,
    red_flags: m.redFlags,
    recommended_actions,
  };
}
