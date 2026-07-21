import type { Contract, CoreDataState, Employee, HrAction } from "./types";

const MS_DAY = 86400000;

export function daysUntil(
  iso: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - now) / MS_DAY);
}

export function contractIsExpiring(
  c: Contract,
  withinDays = 30,
  now = Date.now(),
) {
  if (c.status !== "active") return false;
  const d = daysUntil(c.end_date, now);
  return d !== null && d >= 0 && d <= withinDays;
}

export function contractNoticeApproaching(c: Contract, now = Date.now()) {
  if (c.status !== "active" || !c.end_date || !c.notice_period_days)
    return false;
  const noticeDate =
    new Date(c.end_date).getTime() - c.notice_period_days * MS_DAY;
  const d = Math.round((noticeDate - now) / MS_DAY);
  return d >= 0 && d <= 14;
}

export function contractIssues(c: Contract): string[] {
  const issues: string[] = [];
  if (
    !c.end_date &&
    c.contract_type !== "employment" &&
    c.contract_type !== "office"
  )
    issues.push("Missing end date");
  if (!c.owner) issues.push("Missing owner");
  if (
    c.status === "active" &&
    c.end_date &&
    new Date(c.end_date).getTime() < Date.now()
  )
    issues.push("Expired but marked active");
  if (contractIsExpiring(c)) issues.push("Expires within 30 days");
  if (contractNoticeApproaching(c)) issues.push("Notice deadline approaching");
  if (
    c.next_action &&
    c.next_action_date &&
    new Date(c.next_action_date).getTime() < Date.now()
  )
    issues.push("Overdue action");
  return issues;
}

export function contractMetrics(s: CoreDataState) {
  const c = s.contracts;
  const active = c.filter((x) => x.status === "active");
  return {
    total: c.length,
    active: active.length,
    drafts: c.filter((x) => x.status === "draft").length,
    expiring: active.filter((x) => contractIsExpiring(x)).length,
    high_risk: c.filter((x) => x.risk_level === "high").length,
    total_value: c
      .filter((x) => x.status !== "archived" && x.status !== "expired")
      .reduce((s, x) => s + (x.value || 0), 0),
  };
}

export function employeeMetrics(s: CoreDataState) {
  const e = s.employees;
  const active = e.filter(
    (x) =>
      x.employment_type === "employee" && x.employment_status !== "archived",
  );
  const contractors = e.filter(
    (x) =>
      x.employment_type === "contractor" && x.employment_status !== "archived",
  );
  const newStarters = e.filter(
    (x) => new Date(x.start_date).getTime() > Date.now() - 30 * MS_DAY,
  );
  const open = openHrActions(s);
  return {
    active: active.length,
    contractors: contractors.length,
    new_starters: newStarters.length,
    probation_reviews_due: e.filter(
      (x) =>
        x.probation_end_date && (daysUntil(x.probation_end_date) ?? 999) <= 30,
    ).length,
    rtw_outstanding: e.filter((x) => x.right_to_work_status === "outstanding")
      .length,
    training_due: e.filter(
      (x) =>
        x.training_status === "outstanding" || x.training_status === "overdue",
    ).length,
    policy_missing: e.filter(
      (x) => x.policy_acknowledgement_status === "outstanding",
    ).length,
    open_actions: open.length,
  };
}

export function openHrActions(s: CoreDataState): HrAction[] {
  return s.hr_actions.filter((a) => a.status !== "completed");
}

export function entityMetrics(s: CoreDataState) {
  const e = s.business_entities.filter((x) => x.status !== "archived");
  const by = (t: string) => e.filter((x) => x.entity_type === t);
  return {
    customers: by("customer").length,
    suppliers: by("supplier").length,
    employees: by("employee").length,
    contractors: by("contractor").length,
    advisers: by("adviser").length,
    regulators: by("regulator").length,
    finance: by("bank").length + by("insurer").length,
    reviews_due: e.filter(
      (x) => x.review_date && (daysUntil(x.review_date) ?? 999) <= 30,
    ).length,
    at_risk: e.filter((x) => x.status === "at_risk" || x.risk_level === "high")
      .length,
    missing: e.filter((x) => x.status === "missing_info").length,
  };
}

export function employeeById(
  s: CoreDataState,
  id: string,
): Employee | undefined {
  return s.employees.find((e) => e.id === id);
}

export function contractsForEntity(s: CoreDataState, entityId: string) {
  return s.contracts.filter((c) => c.entity_id === entityId);
}

export function formatGBP(v: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(v);
}
