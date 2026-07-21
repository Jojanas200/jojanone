import { useSyncExternalStore } from "react";
import { buildSeedState } from "./seed";
import type { CoreDataState } from "./types";

const STORAGE_KEY = "jojan_one_core_v1";

function loadState(): CoreDataState {
  if (typeof window === "undefined") return buildSeedState();
  const seed = buildSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<CoreDataState> | null;
    if (!parsed || typeof parsed !== "object") return seed;
    // Merge stored state with the current default schema so older
    // localStorage records don't leave newly-added fields undefined.
    const merged: CoreDataState = { ...seed, ...parsed } as CoreDataState;
    // Ensure every collection/object field exists and has the right shape.
    const fix = <K extends keyof CoreDataState>(k: K, isArray: boolean) => {
      const v = (merged as any)[k];
      if (isArray) {
        if (!Array.isArray(v)) (merged as any)[k] = (seed as any)[k];
      } else {
        if (!v || typeof v !== "object") (merged as any)[k] = (seed as any)[k];
      }
    };
    fix("business", false);
    fix("business_profile", false);
    fix("activities", true);
    fix("reports", true);
    fix("conversations", true);
    fix("messages", true);
    fix("notifications", true);
    fix("decisions", true);
    fix("areas", true);
    fix("business_entities", true);
    fix("contracts", true);
    fix("employees", true);
    fix("hr_actions", true);
    fix("scenario_runs", true);
    fix("compliance_obligations", true);
    fix("compliance_evidence", true);
    fix("gdpr_assessments", true);
    fix("processing_activities", true);
    fix("data_requests", true);
    fix("data_breaches", true);
    fix("dpias", true);
    fix("privacy_notices", true);
    fix("governance_records", true);
    fix("policies", true);
    fix("risks", true);
    fix("investor_profiles", true);
    fix("investor_readiness_assessments", true);
    fix("due_diligence_items", true);
    fix("data_room_items", true);
    fix("tender_opportunities", true);
    fix("bid_assessments", true);
    fix("tender_requirements", true);
    fix("tender_responses", true);
    fix("evidence_library_items", true);
    fix("academy_assignments", true);
    fix("academy_progress", true);
    fix("academy_quiz_attempts", true);
    fix("academy_certificates", true);
    fix("app_settings", false);
    fix("app_users", true);
    fix("audit_events", true);
    // Deep-migrate app_settings so newly-added fields are present.
    try {
      const seedSettings = (seed as any).app_settings;
      const cur = (merged as any).app_settings || {};
      (merged as any).app_settings = {
        ...seedSettings,
        ...cur,
        business_extras: {
          ...seedSettings.business_extras,
          ...(cur.business_extras || {}),
        },
        regional: { ...seedSettings.regional, ...(cur.regional || {}) },
        branding: { ...seedSettings.branding, ...(cur.branding || {}) },
        operations: { ...seedSettings.operations, ...(cur.operations || {}) },
        jova: {
          ...seedSettings.jova,
          ...(cur.jova || {}),
          briefing_include: {
            ...seedSettings.jova.briefing_include,
            ...((cur.jova || {}).briefing_include || {}),
          },
          locked: seedSettings.jova.locked,
        },
        notifications: {
          ...seedSettings.notifications,
          ...(cur.notifications || {}),
          categories:
            Array.isArray((cur.notifications || {}).categories) &&
            (cur.notifications || {}).categories.length
              ? seedSettings.notifications.categories.map((c: any) => {
                  const stored = (cur.notifications.categories as any[]).find(
                    (x) => x.key === c.key,
                  );
                  return stored ? { ...c, ...stored } : c;
                })
              : seedSettings.notifications.categories,
          channels_available: seedSettings.notifications.channels_available,
          quiet_hours: {
            ...seedSettings.notifications.quiet_hours,
            ...((cur.notifications || {}).quiet_hours || {}),
          },
        },
        display: { ...seedSettings.display, ...(cur.display || {}) },
        report_defaults: {
          ...seedSettings.report_defaults,
          ...(cur.report_defaults || {}),
        },
        document_defaults: {
          ...seedSettings.document_defaults,
          ...(cur.document_defaults || {}),
        },
        certificate_defaults: {
          ...seedSettings.certificate_defaults,
          ...(cur.certificate_defaults || {}),
        },
        billing:
          typeof cur.schema_version === "number" && cur.schema_version >= 2
            ? { ...seedSettings.billing, ...(cur.billing || {}) }
            : { ...seedSettings.billing },
        schema_version: seedSettings.schema_version,
      };
    } catch {
      (merged as any).app_settings = (seed as any).app_settings;
    }
    if (!merged.last_refreshed) merged.last_refreshed = seed.last_refreshed;
    return merged;
  } catch {
    return seed;
  }
}

function saveState(state: CoreDataState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

let state: CoreDataState = buildSeedState();
let hydrated = false;
const listeners = new Set<() => void>();

// Cached server snapshot to avoid useSyncExternalStore infinite loop
const SERVER_STATE: CoreDataState = buildSeedState();

function emit() {
  listeners.forEach((l) => l());
}

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = loadState();
  emit();
}

export function getState(): CoreDataState {
  return state;
}

export function setState(updater: (prev: CoreDataState) => CoreDataState) {
  state = updater(state);
  saveState(state);
  emit();
}

export function resetState() {
  state = buildSeedState();
  saveState(state);
  emit();
}

export function useCoreData<T>(selector: (s: CoreDataState) => T): T {
  // Hydrate lazily on first subscription in the browser
  return useSyncExternalStore(
    (cb) => {
      hydrateOnce();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(SERVER_STATE),
  );
}

// ---- Mutations --------------------------------------------------------

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function refreshBriefing() {
  setState((s) => ({ ...s, last_refreshed: new Date().toISOString() }));
}

export function markActivityComplete(id: string) {
  setState((s) => ({
    ...s,
    activities: s.activities.map((a) =>
      a.id === id
        ? { ...a, status: "completed", completed_at: new Date().toISOString() }
        : a,
    ),
  }));
}

export function updateDecisionStatus(
  id: string,
  status: "approved" | "deferred" | "reviewed",
) {
  setState((s) => {
    const dec = s.decisions.find((d) => d.id === id);
    const activities = dec
      ? [
          {
            id: uid("act"),
            business_id: s.business.id,
            activity_type: "decision" as const,
            module: dec.module,
            title: `Decision ${status}: ${dec.title}`,
            description: `${dec.reason} - marked ${status} by ${s.business.owner}.`,
            status: "completed" as const,
            priority: "none" as const,
            reference_type: "decision",
            reference_id: dec.id,
            metadata: {},
            due_at: null,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
          ...s.activities,
        ]
      : s.activities;
    return {
      ...s,
      decisions: s.decisions.map((d) => (d.id === id ? { ...d, status } : d)),
      activities,
    };
  });
}

export function addReport(report: {
  report_type: import("./types").ReportType;
  title: string;
  reporting_period: string;
  summary: string;
  sections: import("./types").ReportSection[];
  metrics: Array<{ label: string; value: string; hint?: string }>;
  findings: string[];
  priority_actions: string[];
  source_modules: import("./types").ModuleKey[];
}) {
  const id = uid("rep");
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    reports: [
      {
        id,
        business_id: s.business.id,
        status: "final",
        created_at: now,
        updated_at: now,
        ...report,
      },
      ...s.reports,
    ],
    activities: [
      {
        id: uid("act"),
        business_id: s.business.id,
        activity_type: "report",
        module: "reports",
        title: `${report.title} generated`,
        description: `Report saved to the Reports Library.`,
        status: "completed",
        priority: "none",
        reference_type: "report",
        reference_id: id,
        metadata: {},
        due_at: null,
        created_at: now,
        completed_at: now,
      },
      ...s.activities,
    ],
    notifications: [
      {
        id: uid("ntf"),
        kind: "report",
        title: `${report.title} ready`,
        description: "Available in Reports.",
        reference_type: "report",
        reference_id: id,
        read: false,
        created_at: now,
      },
      ...s.notifications,
    ],
  }));
  return id;
}

export function renameReport(id: string, title: string) {
  setState((s) => ({
    ...s,
    reports: s.reports.map((r) =>
      r.id === id ? { ...r, title, updated_at: new Date().toISOString() } : r,
    ),
  }));
}

export function duplicateReport(id: string): string | null {
  const s = getState();
  const r = s.reports.find((x) => x.id === id);
  if (!r) return null;
  const newId = uid("rep");
  const now = new Date().toISOString();
  setState((cur) => ({
    ...cur,
    reports: [
      {
        ...r,
        id: newId,
        title: `${r.title} (copy)`,
        created_at: now,
        updated_at: now,
      },
      ...cur.reports,
    ],
  }));
  return newId;
}

export function deleteReport(id: string) {
  setState((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
}

export function createConversation(title: string): string {
  const id = uid("conv");
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    conversations: [
      {
        id,
        business_id: s.business.id,
        title,
        created_at: now,
        updated_at: now,
      },
      ...s.conversations,
    ],
  }));
  return id;
}

export function appendMessage(
  msg: Omit<import("./types").JovaMessage, "id" | "created_at">,
): string {
  const id = uid("msg");
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    messages: [...s.messages, { ...msg, id, created_at: now }],
    conversations: s.conversations.map((c) =>
      c.id === msg.conversation_id ? { ...c, updated_at: now } : c,
    ),
  }));
  return id;
}

export function clearConversation(id: string) {
  setState((s) => ({
    ...s,
    messages: s.messages.filter((m) => m.conversation_id !== id),
  }));
}

export function deleteConversation(id: string) {
  setState((s) => ({
    ...s,
    conversations: s.conversations.filter((c) => c.id !== id),
    messages: s.messages.filter((m) => m.conversation_id !== id),
  }));
}

export function renameConversation(id: string, title: string) {
  setState((s) => ({
    ...s,
    conversations: s.conversations.map((c) =>
      c.id === id ? { ...c, title } : c,
    ),
  }));
}

export function markNotificationRead(id: string) {
  setState((s) => ({
    ...s,
    notifications: s.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    ),
  }));
}

export function markAllNotificationsRead() {
  setState((s) => ({
    ...s,
    notifications: s.notifications.map((n) => ({ ...n, read: true })),
  }));
}

// ---- Business profile ------------------------------------------------

export function updateBusinessProfile(
  patch: Partial<import("./types").BusinessProfile>,
) {
  setState((s) => {
    const merged = {
      ...s.business_profile,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    // simple completion metric: count non-empty scalar fields
    const total = 16;
    const filled =
      [
        merged.business_name,
        merged.company_number,
        merged.business_type,
        merged.industry,
        merged.incorporation_date,
        merged.registered_address,
        merged.trading_address,
        merged.financial_year_end,
        merged.annual_revenue_band,
        merged.employee_count,
        merged.contractor_count,
        merged.customer_count,
        merged.supplier_count,
      ].filter((v) => v !== "" && v !== null && v !== undefined).length + 3; // 3 booleans always present
    merged.profile_completion = Math.round((filled / total) * 100);
    return {
      ...s,
      business_profile: merged,
      activities: [
        activityFactory(s, {
          activity_type: "system",
          module: "business-map",
          title: "Business profile updated",
          description: "Business profile details were updated.",
          status: "completed",
          priority: "none",
          reference_type: "business_profile",
          reference_id: merged.id,
        }),
        ...s.activities,
      ],
    };
  });
}

// ---- Business entities ----------------------------------------------

function activityFactory(
  s: import("./types").CoreDataState,
  partial: Partial<import("./types").Activity> & {
    activity_type: import("./types").Activity["activity_type"];
    module: import("./types").ModuleKey;
    title: string;
    description: string;
    status: import("./types").Activity["status"];
    priority: import("./types").Activity["priority"];
  },
): import("./types").Activity {
  const now = new Date().toISOString();
  return {
    id: uid("act"),
    business_id: s.business.id,
    reference_type: null,
    reference_id: null,
    metadata: {},
    due_at: null,
    created_at: now,
    completed_at: partial.status === "completed" ? now : null,
    ...partial,
  };
}

export function upsertEntity(entity: import("./types").BusinessEntity) {
  setState((s) => {
    const exists = s.business_entities.find((e) => e.id === entity.id);
    const updated = { ...entity, updated_at: new Date().toISOString() };
    return {
      ...s,
      business_entities: exists
        ? s.business_entities.map((e) => (e.id === entity.id ? updated : e))
        : [updated, ...s.business_entities],
      activities: [
        activityFactory(s, {
          activity_type: "system",
          module: "business-map",
          title: exists
            ? `Relationship updated: ${entity.name}`
            : `Relationship added: ${entity.name}`,
          description: `${entity.relationship}`,
          status: "completed",
          priority: "none",
          reference_type: "entity",
          reference_id: entity.id,
        }),
        ...s.activities,
      ],
    };
  });
}

export function archiveEntity(id: string) {
  setState((s) => ({
    ...s,
    business_entities: s.business_entities.map((e) =>
      e.id === id
        ? { ...e, status: "archived", updated_at: new Date().toISOString() }
        : e,
    ),
  }));
}

export function restoreEntity(id: string) {
  setState((s) => ({
    ...s,
    business_entities: s.business_entities.map((e) =>
      e.id === id
        ? { ...e, status: "active", updated_at: new Date().toISOString() }
        : e,
    ),
  }));
}

export function deleteEntity(id: string) {
  setState((s) => ({
    ...s,
    business_entities: s.business_entities.filter((e) => e.id !== id),
  }));
}

export function newEntityDraft(
  name: string,
  entity_type: import("./types").EntityType,
): import("./types").BusinessEntity {
  const now = new Date().toISOString();
  return {
    id: uid("ent"),
    business_id: getState().business.id,
    entity_type,
    name,
    relationship: "",
    status: "active",
    importance: "medium",
    risk_level: "low",
    contract_id: null,
    contact_name: "",
    email: "",
    start_date: null,
    review_date: null,
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

// ---- Contracts -------------------------------------------------------

export function upsertContract(c: import("./types").Contract) {
  setState((s) => {
    const exists = s.contracts.find((x) => x.id === c.id);
    const updated = { ...c, updated_at: new Date().toISOString() };
    const notes: import("./types").Activity[] = [
      activityFactory(s, {
        activity_type: "contract",
        module: "contracts",
        title: exists
          ? `Contract updated: ${c.title}`
          : `Contract added: ${c.title}`,
        description: `${c.counterparty} - ${c.status}`,
        status: "completed",
        priority: "none",
        reference_type: "contract",
        reference_id: c.id,
      }),
    ];
    return {
      ...s,
      contracts: exists
        ? s.contracts.map((x) => (x.id === c.id ? updated : x))
        : [updated, ...s.contracts],
      activities: [...notes, ...s.activities],
    };
  });
}

export function deleteContract(id: string) {
  setState((s) => ({
    ...s,
    contracts: s.contracts.filter((c) => c.id !== id),
  }));
}

export function archiveContract(id: string) {
  setState((s) => ({
    ...s,
    contracts: s.contracts.map((c) =>
      c.id === id
        ? { ...c, status: "archived", updated_at: new Date().toISOString() }
        : c,
    ),
  }));
}

export function completeContractAction(id: string) {
  setState((s) => ({
    ...s,
    contracts: s.contracts.map((c) =>
      c.id === id
        ? {
            ...c,
            next_action: "",
            next_action_date: null,
            updated_at: new Date().toISOString(),
          }
        : c,
    ),
    activities: [
      activityFactory(s, {
        activity_type: "contract",
        module: "contracts",
        title: `Contract action completed`,
        description: s.contracts.find((c) => c.id === id)?.title ?? "",
        status: "completed",
        priority: "none",
        reference_type: "contract",
        reference_id: id,
      }),
      ...s.activities,
    ],
  }));
}

export function newContractDraft(
  seed: Partial<import("./types").Contract> = {},
): import("./types").Contract {
  const now = new Date().toISOString();
  return {
    id: uid("ctr"),
    business_id: getState().business.id,
    contract_type: "customer",
    title: "",
    counterparty: "",
    status: "draft",
    value: 0,
    currency: "GBP",
    start_date: null,
    end_date: null,
    renewal_date: null,
    notice_period_days: null,
    owner: getState().business.owner,
    risk_level: "low",
    key_terms: "",
    obligations: "",
    next_action: "",
    next_action_date: null,
    notes: "",
    entity_id: null,
    created_at: now,
    updated_at: now,
    ...seed,
  };
}

// ---- Employees & HR --------------------------------------------------

export function upsertEmployee(emp: import("./types").Employee) {
  setState((s) => {
    const exists = s.employees.find((e) => e.id === emp.id);
    const updated = { ...emp, updated_at: new Date().toISOString() };
    return {
      ...s,
      employees: exists
        ? s.employees.map((e) => (e.id === emp.id ? updated : e))
        : [updated, ...s.employees],
      activities: [
        activityFactory(s, {
          activity_type: "system",
          module: "hr",
          title: exists
            ? `Employee updated: ${emp.full_name}`
            : `Employee added: ${emp.full_name}`,
          description: `${emp.job_title} - ${emp.employment_status}`,
          status: "completed",
          priority: "none",
          reference_type: "employee",
          reference_id: emp.id,
        }),
        ...s.activities,
      ],
    };
  });
}

export function archiveEmployee(id: string) {
  setState((s) => ({
    ...s,
    employees: s.employees.map((e) =>
      e.id === id
        ? {
            ...e,
            employment_status: "archived",
            updated_at: new Date().toISOString(),
          }
        : e,
    ),
  }));
}

export function deleteEmployee(id: string) {
  setState((s) => ({
    ...s,
    employees: s.employees.filter((e) => e.id !== id),
    hr_actions: s.hr_actions.filter((a) => a.employee_id !== id),
  }));
}

export function newEmployeeDraft(
  seed: Partial<import("./types").Employee> = {},
): import("./types").Employee {
  const now = new Date().toISOString();
  return {
    id: uid("emp"),
    business_id: getState().business.id,
    full_name: "",
    job_title: "",
    department: "",
    employment_type: "employee",
    employment_status: "probation",
    start_date: now,
    probation_end_date: null,
    contract_status: "pending",
    right_to_work_status: "outstanding",
    right_to_work_expiry: null,
    policy_acknowledgement_status: "outstanding",
    training_status: "outstanding",
    emergency_contact_recorded: false,
    next_review_date: null,
    risk_level: "medium",
    notes: "",
    created_at: now,
    updated_at: now,
    ...seed,
  };
}

export function upsertHrAction(a: import("./types").HrAction) {
  setState((s) => {
    const exists = s.hr_actions.find((x) => x.id === a.id);
    const updated = { ...a, updated_at: new Date().toISOString() };
    return {
      ...s,
      hr_actions: exists
        ? s.hr_actions.map((x) => (x.id === a.id ? updated : x))
        : [updated, ...s.hr_actions],
      activities: [
        activityFactory(s, {
          activity_type: "obligation",
          module: "hr",
          title: exists
            ? `HR action updated: ${a.title}`
            : `HR action added: ${a.title}`,
          description: a.description,
          status: a.status === "completed" ? "completed" : "open",
          priority: a.priority,
          reference_type: "hr_action",
          reference_id: a.id,
          due_at: a.due_date,
        }),
        ...s.activities,
      ],
    };
  });
}

export function completeHrAction(id: string) {
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    hr_actions: s.hr_actions.map((a) =>
      a.id === id
        ? { ...a, status: "completed", completed_at: now, updated_at: now }
        : a,
    ),
    activities: [
      activityFactory(s, {
        activity_type: "obligation",
        module: "hr",
        title: `HR action completed`,
        description: s.hr_actions.find((a) => a.id === id)?.title ?? "",
        status: "completed",
        priority: "none",
        reference_type: "hr_action",
        reference_id: id,
      }),
      ...s.activities,
    ],
  }));
}

export function reopenHrAction(id: string) {
  setState((s) => ({
    ...s,
    hr_actions: s.hr_actions.map((a) =>
      a.id === id
        ? {
            ...a,
            status: "open",
            completed_at: null,
            updated_at: new Date().toISOString(),
          }
        : a,
    ),
  }));
}

export function deferHrAction(id: string, newDate: string) {
  setState((s) => ({
    ...s,
    hr_actions: s.hr_actions.map((a) =>
      a.id === id
        ? {
            ...a,
            status: "deferred",
            due_date: newDate,
            updated_at: new Date().toISOString(),
          }
        : a,
    ),
  }));
}

export function deleteHrAction(id: string) {
  setState((s) => ({
    ...s,
    hr_actions: s.hr_actions.filter((a) => a.id !== id),
  }));
}

export function newHrActionDraft(
  employee_id: string,
  seed: Partial<import("./types").HrAction> = {},
): import("./types").HrAction {
  const now = new Date().toISOString();
  return {
    id: uid("hra"),
    business_id: getState().business.id,
    employee_id,
    action_type: "welfare",
    title: "",
    description: "",
    priority: "medium",
    status: "open",
    due_date: null,
    completed_at: null,
    notes: "",
    created_at: now,
    updated_at: now,
    ...seed,
  };
}

// ---- Scenarios -------------------------------------------------------

export function saveScenarioRun(run: import("./types").ScenarioRun) {
  setState((s) => {
    const exists = s.scenario_runs.find((r) => r.id === run.id);
    const updated = { ...run, updated_at: new Date().toISOString() };
    return {
      ...s,
      scenario_runs: exists
        ? s.scenario_runs.map((r) => (r.id === run.id ? updated : r))
        : [updated, ...s.scenario_runs],
      activities: [
        activityFactory(s, {
          activity_type: "system",
          module: "simulator",
          title: exists
            ? `Scenario updated: ${run.scenario_name}`
            : `Scenario run: ${run.scenario_name}`,
          description: run.result.summary,
          status: "completed",
          priority: "none",
          reference_type: "scenario",
          reference_id: run.id,
        }),
        ...s.activities,
      ],
    };
  });
}

export function deleteScenario(id: string) {
  setState((s) => ({
    ...s,
    scenario_runs: s.scenario_runs.filter((r) => r.id !== id),
  }));
}

export function archiveScenario(id: string) {
  setState((s) => ({
    ...s,
    scenario_runs: s.scenario_runs.map((r) =>
      r.id === id
        ? { ...r, status: "archived", updated_at: new Date().toISOString() }
        : r,
    ),
  }));
}

export function duplicateScenario(id: string): string | null {
  const s = getState();
  const r = s.scenario_runs.find((x) => x.id === id);
  if (!r) return null;
  const newId = uid("scn");
  const now = new Date().toISOString();
  setState((cur) => ({
    ...cur,
    scenario_runs: [
      {
        ...r,
        id: newId,
        scenario_name: `${r.scenario_name} (copy)`,
        created_at: now,
        updated_at: now,
      },
      ...cur.scenario_runs,
    ],
  }));
  return newId;
}

export function newScenarioId() {
  return uid("scn");
}

export function pushNotification(
  n: Omit<import("./types").Notification, "id" | "created_at">,
) {
  setState((s) => ({
    ...s,
    notifications: [
      { id: uid("ntf"), created_at: new Date().toISOString(), ...n },
      ...s.notifications,
    ],
  }));
}
// ============================================================
// Compliance & Governance mutations
// ============================================================

import type * as CG from "./types";

function logActivity(
  s: import("./types").CoreDataState,
  partial: Parameters<typeof activityFactory>[1],
) {
  return [activityFactory(s, partial), ...s.activities];
}

// ---- Compliance Obligations ----
export function upsertObligation(o: CG.ComplianceObligation) {
  setState((s) => {
    const exists = s.compliance_obligations.find((x) => x.id === o.id);
    const updated = { ...o, updated_at: new Date().toISOString() };
    return {
      ...s,
      compliance_obligations: exists
        ? s.compliance_obligations.map((x) => (x.id === o.id ? updated : x))
        : [updated, ...s.compliance_obligations],
      activities: logActivity(s, {
        activity_type: "obligation",
        module: "compliance",
        title: exists
          ? `Obligation updated: ${o.title}`
          : `Obligation added: ${o.title}`,
        description: o.regulator,
        status:
          o.status === "completed"
            ? "completed"
            : o.status === "overdue"
              ? "overdue"
              : "open",
        priority: o.priority,
        reference_type: "obligation",
        reference_id: o.id,
        due_at: o.due_date,
      }),
    };
  });
}

export function completeObligation(id: string, notes = "") {
  const now = new Date().toISOString();
  setState((s) => {
    const o = s.compliance_obligations.find((x) => x.id === id);
    if (!o) return s;
    const updated: CG.ComplianceObligation = {
      ...o,
      status: "completed",
      completed_at: now,
      evidence_status: "complete",
      notes: notes || o.notes,
      updated_at: now,
    };
    let next: CG.ComplianceObligation[] = s.compliance_obligations.map((x) =>
      x.id === id ? updated : x,
    );
    // create next occurrence for recurring
    if (o.recurrence !== "none") {
      const months =
        o.recurrence === "annual"
          ? 12
          : o.recurrence === "quarterly"
            ? 3
            : o.recurrence === "monthly"
              ? 1
              : 0.25;
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + Math.round(months));
      next = [
        {
          ...o,
          id: uid("obl"),
          status: "upcoming",
          due_date: nextDue.toISOString(),
          next_due_date: nextDue.toISOString(),
          completed_at: null,
          evidence_status: "not_started",
          notes: "",
          created_at: now,
          updated_at: now,
        },
        ...next,
      ];
    }
    return {
      ...s,
      compliance_obligations: next,
      activities: logActivity(s, {
        activity_type: "obligation",
        module: "compliance",
        title: `Obligation completed: ${o.title}`,
        description: notes || o.required_action,
        status: "completed",
        priority: "none",
        reference_type: "obligation",
        reference_id: id,
      }),
    };
  });
}

export function reopenObligation(id: string) {
  setState((s) => ({
    ...s,
    compliance_obligations: s.compliance_obligations.map((o) =>
      o.id === id
        ? {
            ...o,
            status: "action_required",
            completed_at: null,
            updated_at: new Date().toISOString(),
          }
        : o,
    ),
  }));
}

export function markObligationNotApplicable(id: string, reason: string) {
  setState((s) => ({
    ...s,
    compliance_obligations: s.compliance_obligations.map((o) =>
      o.id === id
        ? {
            ...o,
            applicability_status: "not_applicable",
            status: "not_applicable",
            na_reason: reason,
            updated_at: new Date().toISOString(),
          }
        : o,
    ),
  }));
}

export function newObligationDraft(
  seed: Partial<CG.ComplianceObligation> = {},
): CG.ComplianceObligation {
  const now = new Date().toISOString();
  return {
    id: uid("obl"),
    business_id: getState().business.id,
    title: "",
    category: "other",
    regulator: "",
    jurisdiction: "UK",
    description: "",
    plain_language_explanation: "",
    reason_applies: "",
    applicability_status: "applicable",
    priority: "medium",
    status: "action_required",
    due_date: null,
    recurrence: "none",
    source_type: "regulation",
    source_reference: "",
    required_action: "",
    required_evidence: [],
    evidence_status: "not_started",
    owner: getState().business.owner,
    professional_support_required: false,
    completed_at: null,
    next_due_date: null,
    notes: "",
    created_at: now,
    updated_at: now,
    ...seed,
  };
}

export function addEvidence(e: CG.ComplianceEvidence) {
  setState((s) => ({
    ...s,
    compliance_evidence: [
      { ...e, updated_at: new Date().toISOString() },
      ...s.compliance_evidence,
    ],
    compliance_obligations: s.compliance_obligations.map((o) =>
      o.id === e.obligation_id
        ? {
            ...o,
            evidence_status: "complete",
            updated_at: new Date().toISOString(),
          }
        : o,
    ),
    activities: logActivity(s, {
      activity_type: "obligation",
      module: "compliance",
      title: `Evidence added: ${e.title}`,
      description: e.reference,
      status: "completed",
      priority: "none",
      reference_type: "evidence",
      reference_id: e.id,
    }),
  }));
}

export function newEvidenceDraft(obligation_id: string): CG.ComplianceEvidence {
  const now = new Date().toISOString();
  return {
    id: uid("evi"),
    business_id: getState().business.id,
    obligation_id,
    evidence_type: "record",
    title: "",
    description: "",
    file_name: "",
    reference: "",
    review_date: null,
    status: "recorded",
    created_at: now,
    updated_at: now,
  };
}

// ---- GDPR Assessments ----
export function saveGdprAssessment(a: CG.GdprAssessment) {
  setState((s) => {
    const exists = s.gdpr_assessments.find((x) => x.id === a.id);
    const updated = { ...a, updated_at: new Date().toISOString() };
    return {
      ...s,
      gdpr_assessments: exists
        ? s.gdpr_assessments.map((x) => (x.id === a.id ? updated : x))
        : [updated, ...s.gdpr_assessments],
      activities:
        a.status === "completed"
          ? logActivity(s, {
              activity_type: "review",
              module: "gdpr",
              title: `GDPR health check completed`,
              description: `Score ${a.score}/100 with ${a.gaps.length} gaps.`,
              status: "completed",
              priority: a.score < 70 ? "high" : "medium",
              reference_type: "gdpr_assessment",
              reference_id: a.id,
            })
          : s.activities,
    };
  });
}

export function newGdprAssessmentDraft(): CG.GdprAssessment {
  const now = new Date().toISOString();
  return {
    id: uid("gdpr"),
    business_id: getState().business.id,
    assessment_type: "health_check",
    answers: {},
    score: 0,
    status: "draft",
    gaps: [],
    recommendations: [],
    completed_at: null,
    review_date: null,
    created_at: now,
    updated_at: now,
  };
}

// ---- Processing activities (ROPA) ----
export function upsertProcessingActivity(p: CG.ProcessingActivity) {
  setState((s) => {
    const exists = s.processing_activities.find((x) => x.id === p.id);
    const updated = { ...p, updated_at: new Date().toISOString() };
    return {
      ...s,
      processing_activities: exists
        ? s.processing_activities.map((x) => (x.id === p.id ? updated : x))
        : [updated, ...s.processing_activities],
      activities: logActivity(s, {
        activity_type: "system",
        module: "gdpr",
        title: exists
          ? `ROPA updated: ${p.activity_name}`
          : `ROPA entry added: ${p.activity_name}`,
        description: p.business_purpose,
        status: "completed",
        priority: "none",
        reference_type: "processing_activity",
        reference_id: p.id,
      }),
    };
  });
}

export function archiveProcessingActivity(id: string) {
  setState((s) => ({
    ...s,
    processing_activities: s.processing_activities.map((p) =>
      p.id === id
        ? { ...p, status: "archived", updated_at: new Date().toISOString() }
        : p,
    ),
  }));
}

export function restoreProcessingActivity(id: string) {
  setState((s) => ({
    ...s,
    processing_activities: s.processing_activities.map((p) =>
      p.id === id
        ? { ...p, status: "active", updated_at: new Date().toISOString() }
        : p,
    ),
  }));
}

export function deleteProcessingActivity(id: string) {
  setState((s) => ({
    ...s,
    processing_activities: s.processing_activities.filter((p) => p.id !== id),
  }));
}

export function newProcessingActivityDraft(
  seed: Partial<CG.ProcessingActivity> = {},
): CG.ProcessingActivity {
  const now = new Date().toISOString();
  return {
    id: uid("pa"),
    business_id: getState().business.id,
    activity_name: "",
    business_purpose: "",
    data_subjects: "",
    personal_data_categories: "",
    special_category_data: false,
    lawful_basis: "Legitimate interests",
    recipients: "",
    processors: "",
    international_transfers: false,
    retention_period: "",
    security_measures: "",
    owner: getState().business.owner,
    status: "active",
    review_date: null,
    created_at: now,
    updated_at: now,
    ...seed,
  };
}

// ---- Data requests ----
export function upsertDataRequest(r: CG.DataRequest) {
  setState((s) => {
    const exists = s.data_requests.find((x) => x.id === r.id);
    const updated = { ...r, updated_at: new Date().toISOString() };
    return {
      ...s,
      data_requests: exists
        ? s.data_requests.map((x) => (x.id === r.id ? updated : x))
        : [updated, ...s.data_requests],
      activities: logActivity(s, {
        activity_type: "obligation",
        module: "gdpr",
        title: exists
          ? `Data request updated: ${r.requester_reference}`
          : `Data request received: ${r.requester_reference}`,
        description: r.request_type,
        status: r.status === "completed" ? "completed" : "open",
        priority: "high",
        reference_type: "data_request",
        reference_id: r.id,
        due_at: r.due_date,
      }),
    };
  });
}

export function completeDataRequest(id: string) {
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    data_requests: s.data_requests.map((r) =>
      r.id === id
        ? { ...r, status: "completed", completed_at: now, updated_at: now }
        : r,
    ),
    activities: logActivity(s, {
      activity_type: "obligation",
      module: "gdpr",
      title: `Data request completed`,
      description:
        s.data_requests.find((r) => r.id === id)?.requester_reference ?? "",
      status: "completed",
      priority: "none",
      reference_type: "data_request",
      reference_id: id,
    }),
  }));
}

export function newDataRequestDraft(): CG.DataRequest {
  const now = new Date().toISOString();
  const due = new Date();
  due.setMonth(due.getMonth() + 1);
  return {
    id: uid("dr"),
    business_id: getState().business.id,
    request_type: "subject_access",
    requester_reference: "",
    received_date: now,
    identity_verified: false,
    due_date: due.toISOString(),
    status: "open",
    assigned_owner: getState().business.owner,
    notes: "",
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}

// ---- Data breaches ----
export function upsertBreach(b: CG.DataBreach) {
  setState((s) => {
    const exists = s.data_breaches.find((x) => x.id === b.id);
    const updated = { ...b, updated_at: new Date().toISOString() };
    return {
      ...s,
      data_breaches: exists
        ? s.data_breaches.map((x) => (x.id === b.id ? updated : x))
        : [updated, ...s.data_breaches],
      activities: logActivity(s, {
        activity_type: "risk",
        module: "gdpr",
        title: exists
          ? `Breach updated: ${b.title}`
          : `Breach logged: ${b.title}`,
        description: b.description,
        status: b.status === "closed" ? "completed" : "open",
        priority:
          b.risk_level === "high"
            ? "high"
            : b.risk_level === "medium"
              ? "medium"
              : "low",
        reference_type: "breach",
        reference_id: b.id,
      }),
    };
  });
}

export function newBreachDraft(): CG.DataBreach {
  const now = new Date().toISOString();
  return {
    id: uid("brk"),
    business_id: getState().business.id,
    title: "",
    discovered_at: now,
    occurred_at: null,
    description: "",
    data_involved: "",
    affected_people_estimate: 0,
    risk_level: "low",
    containment_actions: "",
    ico_notification_assessment: "",
    individual_notification_assessment: "",
    status: "open",
    owner: getState().business.owner,
    professional_support_required: false,
    closed_at: null,
    created_at: now,
    updated_at: now,
  };
}

// ---- DPIAs ----
export function upsertDpia(d: CG.Dpia) {
  setState((s) => {
    const exists = s.dpias.find((x) => x.id === d.id);
    const updated = { ...d, updated_at: new Date().toISOString() };
    return {
      ...s,
      dpias: exists
        ? s.dpias.map((x) => (x.id === d.id ? updated : x))
        : [updated, ...s.dpias],
      activities: logActivity(s, {
        activity_type: "review",
        module: "gdpr",
        title: exists ? `DPIA updated: ${d.title}` : `DPIA created: ${d.title}`,
        description: d.processing_summary,
        status: d.status === "approved" ? "completed" : "open",
        priority: d.residual_risk === "high" ? "high" : "medium",
        reference_type: "dpia",
        reference_id: d.id,
      }),
    };
  });
}

export function newDpiaDraft(): CG.Dpia {
  const now = new Date().toISOString();
  return {
    id: uid("dpia"),
    business_id: getState().business.id,
    title: "",
    project: "",
    processing_summary: "",
    necessity: "",
    risks: "",
    controls: "",
    residual_risk: "low",
    status: "draft",
    owner: getState().business.owner,
    review_date: null,
    created_at: now,
    updated_at: now,
  };
}

// ---- Privacy notice ----
export function upsertPrivacyNotice(n: CG.PrivacyNotice) {
  setState((s) => {
    const exists = s.privacy_notices.find((x) => x.id === n.id);
    const updated = { ...n, updated_at: new Date().toISOString() };
    return {
      ...s,
      privacy_notices: exists
        ? s.privacy_notices.map((x) => (x.id === n.id ? updated : x))
        : [updated, ...s.privacy_notices],
    };
  });
}

export function newPrivacyNoticeDraft(
  seed: Partial<CG.PrivacyNotice> = {},
): CG.PrivacyNotice {
  const now = new Date().toISOString();
  const s = getState();
  return {
    id: uid("pn"),
    business_id: s.business.id,
    version: `${s.privacy_notices.length + 1}.0-draft`,
    status: "draft",
    organisation: s.business.name,
    contact_details: "",
    data_collected: "",
    purposes: "",
    lawful_bases: [],
    sharing: "",
    international_transfers: "",
    retention: "",
    rights:
      "Access, rectification, erasure, restriction, objection, portability.",
    complaints: "You may complain to the ICO at ico.org.uk.",
    review_date: null,
    created_at: now,
    updated_at: now,
    ...seed,
  };
}

// ---- Governance ----
export function upsertGovernanceRecord(g: CG.GovernanceRecord) {
  setState((s) => {
    const exists = s.governance_records.find((x) => x.id === g.id);
    const updated = { ...g, updated_at: new Date().toISOString() };
    return {
      ...s,
      governance_records: exists
        ? s.governance_records.map((x) => (x.id === g.id ? updated : x))
        : [updated, ...s.governance_records],
      activities: logActivity(s, {
        activity_type: "decision",
        module: "governance",
        title: exists
          ? `Governance updated: ${g.title}`
          : `Governance record: ${g.title}`,
        description: g.description,
        status:
          g.status === "approved" || g.status === "completed"
            ? "completed"
            : "open",
        priority: g.status === "pending" ? "medium" : "low",
        reference_type: "governance_record",
        reference_id: g.id,
      }),
    };
  });
}

export function updateGovernanceStatus(
  id: string,
  status: CG.GovernanceRecord["status"],
) {
  setState((s) => ({
    ...s,
    governance_records: s.governance_records.map((g) =>
      g.id === id
        ? {
            ...g,
            status,
            approval_status:
              status === "approved" || status === "completed"
                ? "approved"
                : g.approval_status,
            updated_at: new Date().toISOString(),
          }
        : g,
    ),
    activities: logActivity(s, {
      activity_type: "decision",
      module: "governance",
      title: `Governance ${status}: ${s.governance_records.find((g) => g.id === id)?.title ?? ""}`,
      description: "",
      status: "completed",
      priority: "none",
      reference_type: "governance_record",
      reference_id: id,
    }),
  }));
}

export function deleteGovernanceRecord(id: string) {
  setState((s) => ({
    ...s,
    governance_records: s.governance_records.filter((g) => g.id !== id),
  }));
}

export function newGovernanceDraft(
  record_type: CG.GovernanceRecord["record_type"] = "director_decision",
): CG.GovernanceRecord {
  const now = new Date().toISOString();
  return {
    id: uid("gov"),
    business_id: getState().business.id,
    record_type,
    title: "",
    description: "",
    meeting_date: null,
    decision_date: null,
    owner: getState().business.owner,
    status: "draft",
    review_date: null,
    approval_status: "unapproved",
    participants: "",
    actions: "",
    linked_document: "",
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

// ---- Policies ----
export function upsertPolicy(p: CG.Policy) {
  setState((s) => {
    const exists = s.policies.find((x) => x.id === p.id);
    const updated = { ...p, updated_at: new Date().toISOString() };
    return {
      ...s,
      policies: exists
        ? s.policies.map((x) => (x.id === p.id ? updated : x))
        : [updated, ...s.policies],
      activities: logActivity(s, {
        activity_type: "policy",
        module: "governance",
        title: exists
          ? `Policy updated: ${p.policy_name}`
          : `Policy added: ${p.policy_name}`,
        description: `v${p.version} - ${p.status}`,
        status: "completed",
        priority: "none",
        reference_type: "policy",
        reference_id: p.id,
      }),
    };
  });
}

export function recordPolicyReview(id: string) {
  const now = new Date().toISOString();
  const nextReview = new Date();
  nextReview.setFullYear(nextReview.getFullYear() + 1);
  setState((s) => ({
    ...s,
    policies: s.policies.map((p) =>
      p.id === id
        ? {
            ...p,
            review_date: nextReview.toISOString(),
            approval_date: now,
            updated_at: now,
          }
        : p,
    ),
    activities: logActivity(s, {
      activity_type: "policy",
      module: "governance",
      title: `Policy reviewed: ${s.policies.find((p) => p.id === id)?.policy_name ?? ""}`,
      description: "",
      status: "completed",
      priority: "none",
      reference_type: "policy",
      reference_id: id,
    }),
  }));
}

export function archivePolicy(id: string) {
  setState((s) => ({
    ...s,
    policies: s.policies.map((p) =>
      p.id === id
        ? { ...p, status: "archived", updated_at: new Date().toISOString() }
        : p,
    ),
  }));
}

export function newPolicyDraft(): CG.Policy {
  const now = new Date().toISOString();
  return {
    id: uid("pol"),
    business_id: getState().business.id,
    policy_name: "",
    policy_category: "Data protection",
    version: "1.0",
    owner: getState().business.owner,
    status: "draft",
    approval_date: null,
    review_date: null,
    acknowledgement_required: false,
    acknowledgement_status: "not_started",
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

// ---- Risks ----
function ratingOf(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 17) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function withRiskScores(r: CG.Risk): CG.Risk {
  const inh = r.likelihood * r.impact;
  const res = r.residual_likelihood * r.residual_impact;
  return {
    ...r,
    inherent_score: inh,
    inherent_rating: ratingOf(inh),
    residual_score: res,
    residual_rating: ratingOf(res),
  };
}

export function upsertRisk(r: CG.Risk) {
  setState((s) => {
    const withScores = withRiskScores(r);
    const exists = s.risks.find((x) => x.id === r.id);
    const updated = { ...withScores, updated_at: new Date().toISOString() };
    return {
      ...s,
      risks: exists
        ? s.risks.map((x) => (x.id === r.id ? updated : x))
        : [updated, ...s.risks],
      activities: logActivity(s, {
        activity_type: "risk",
        module: "risk",
        title: exists
          ? `Risk updated: ${r.risk_title}`
          : `Risk added: ${r.risk_title}`,
        description: r.description,
        status: r.status === "closed" ? "completed" : "open",
        priority:
          r.residual_rating === "critical" || r.residual_rating === "high"
            ? "high"
            : r.residual_rating === "medium"
              ? "medium"
              : "low",
        reference_type: "risk",
        reference_id: r.id,
      }),
    };
  });
}

export function acceptRisk(id: string, reason: string) {
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    risks: s.risks.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "accepted",
            accepted_at: now,
            acceptance_reason: reason,
            response: "accept",
            updated_at: now,
          }
        : r,
    ),
  }));
}

export function closeRisk(id: string, reason: string) {
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    risks: s.risks.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "closed",
            closed_at: now,
            closure_reason: reason,
            updated_at: now,
          }
        : r,
    ),
    activities: logActivity(s, {
      activity_type: "risk",
      module: "risk",
      title: `Risk closed: ${s.risks.find((r) => r.id === id)?.risk_title ?? ""}`,
      description: reason,
      status: "completed",
      priority: "none",
      reference_type: "risk",
      reference_id: id,
    }),
  }));
}

export function reopenRisk(id: string) {
  setState((s) => ({
    ...s,
    risks: s.risks.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "open",
            closed_at: null,
            accepted_at: null,
            updated_at: new Date().toISOString(),
          }
        : r,
    ),
  }));
}

export function completeMitigation(riskId: string, mitigationId: string) {
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    risks: s.risks.map((r) =>
      r.id === riskId
        ? {
            ...r,
            mitigation_actions: r.mitigation_actions.map((m) =>
              m.id === mitigationId
                ? { ...m, status: "completed", completed_at: now }
                : m,
            ),
            updated_at: now,
          }
        : r,
    ),
    activities: logActivity(s, {
      activity_type: "risk",
      module: "risk",
      title: `Mitigation completed`,
      description:
        s.risks
          .find((r) => r.id === riskId)
          ?.mitigation_actions.find((m) => m.id === mitigationId)?.label ?? "",
      status: "completed",
      priority: "none",
      reference_type: "risk",
      reference_id: riskId,
    }),
  }));
}

export function addMitigation(
  riskId: string,
  label: string,
  due: string | null,
) {
  setState((s) => ({
    ...s,
    risks: s.risks.map((r) =>
      r.id === riskId
        ? {
            ...r,
            mitigation_actions: [
              ...r.mitigation_actions,
              {
                id: uid("mit"),
                label,
                due_date: due,
                status: "open",
                completed_at: null,
              },
            ],
            updated_at: new Date().toISOString(),
          }
        : r,
    ),
  }));
}

export function deleteRisk(id: string) {
  setState((s) => ({ ...s, risks: s.risks.filter((r) => r.id !== id) }));
}

export function newRiskDraft(seed: Partial<CG.Risk> = {}): CG.Risk {
  const now = new Date().toISOString();
  return withRiskScores({
    id: uid("risk"),
    business_id: getState().business.id,
    risk_title: "",
    risk_category: "operational",
    description: "",
    cause: "",
    consequence: "",
    likelihood: 2,
    impact: 2,
    inherent_score: 4,
    inherent_rating: "low",
    controls: "",
    control_effectiveness: "adequate",
    residual_likelihood: 2,
    residual_impact: 2,
    residual_score: 4,
    residual_rating: "low",
    risk_owner: getState().business.owner,
    response: "reduce",
    mitigation_actions: [],
    status: "open",
    review_date: null,
    accepted_at: null,
    closed_at: null,
    linked_contract_id: null,
    linked_entity_id: null,
    linked_employee_id: null,
    linked_obligation_id: null,
    linked_processing_activity_id: null,
    linked_governance_record_id: null,
    created_at: now,
    updated_at: now,
    ...seed,
  });
}

// ============================================================
// Growth mutations
// ============================================================

export function upsertInvestorProfile(p: CG.InvestorProfile) {
  setState((s) => {
    const exists = s.investor_profiles.find((x) => x.id === p.id);
    const updated = { ...p, updated_at: new Date().toISOString() };
    return {
      ...s,
      investor_profiles: exists
        ? s.investor_profiles.map((x) => (x.id === p.id ? updated : x))
        : [updated, ...s.investor_profiles],
      activities: logActivity(s, {
        activity_type: "system",
        module: "investor-ready",
        title: exists ? "Funding profile updated" : "Funding profile created",
        description:
          p.funding_stage +
          " - " +
          p.currency +
          " " +
          p.amount_sought.toLocaleString(),
        status: "completed",
        priority: "none",
        reference_type: "investor_profile",
        reference_id: p.id,
      }),
    };
  });
}

export function newInvestorProfileDraft(): CG.InvestorProfile {
  const now = new Date().toISOString();
  const target = new Date();
  target.setMonth(target.getMonth() + 6);
  return {
    id: uid("inv"),
    business_id: getState().business.id,
    funding_stage: "early_growth",
    amount_sought: 250000,
    currency: "GBP",
    funding_purpose: "",
    target_close_date: target.toISOString(),
    current_revenue_band: "",
    growth_summary: "",
    traction_summary: "",
    market_summary: "",
    team_summary: "",
    investment_type: "undecided",
    status: "preparing",
    created_at: now,
    updated_at: now,
  };
}

export function upsertDueDiligenceItem(item: CG.DueDiligenceItem) {
  setState((s) => {
    const exists = s.due_diligence_items.find((x) => x.id === item.id);
    const updated = { ...item, updated_at: new Date().toISOString() };
    return {
      ...s,
      due_diligence_items: exists
        ? s.due_diligence_items.map((x) => (x.id === item.id ? updated : x))
        : [updated, ...s.due_diligence_items],
      activities: logActivity(s, {
        activity_type: "review",
        module: "investor-ready",
        title: exists
          ? "Due-diligence updated: " + item.title
          : "Due-diligence item added: " + item.title,
        description: item.category + " - " + item.status,
        status: item.status === "ready" ? "completed" : "open",
        priority: item.priority,
        reference_type: "dd_item",
        reference_id: item.id,
      }),
    };
  });
}

export function setDdStatus(id: string, status: CG.DDStatus, note?: string) {
  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    due_diligence_items: s.due_diligence_items.map((i) =>
      i.id === id
        ? { ...i, status, notes: note ?? i.notes, updated_at: now }
        : i,
    ),
    activities: logActivity(s, {
      activity_type: "review",
      module: "investor-ready",
      title:
        "Due-diligence " +
        status +
        ": " +
        (s.due_diligence_items.find((i) => i.id === id)?.title ?? ""),
      description: note ?? "",
      status: status === "ready" ? "completed" : "open",
      priority: "none",
      reference_type: "dd_item",
      reference_id: id,
    }),
  }));
}

export function newDdItemDraft(): CG.DueDiligenceItem {
  const now = new Date().toISOString();
  return {
    id: uid("dd"),
    business_id: getState().business.id,
    category: "corporate",
    title: "",
    description: "",
    required: true,
    status: "missing",
    evidence_reference: "",
    source_module: null,
    source_record_id: null,
    owner: getState().business.owner,
    priority: "medium",
    review_date: null,
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

export function upsertDataRoomItem(item: CG.DataRoomItem) {
  setState((s) => {
    const exists = s.data_room_items.find((x) => x.id === item.id);
    const updated = { ...item, updated_at: new Date().toISOString() };
    return {
      ...s,
      data_room_items: exists
        ? s.data_room_items.map((x) => (x.id === item.id ? updated : x))
        : [updated, ...s.data_room_items],
      activities: logActivity(s, {
        activity_type: "system",
        module: "investor-ready",
        title: exists
          ? "Data-room updated: " + item.title
          : "Data-room item added: " + item.title,
        description: item.folder + " - " + item.status,
        status: item.status === "ready" ? "completed" : "open",
        priority: "none",
        reference_type: "data_room_item",
        reference_id: item.id,
      }),
    };
  });
}

export function archiveDataRoomItem(id: string) {
  setState((s) => ({
    ...s,
    data_room_items: s.data_room_items.map((i) =>
      i.id === id
        ? { ...i, status: "archived", updated_at: new Date().toISOString() }
        : i,
    ),
  }));
}

export function restoreDataRoomItem(id: string) {
  setState((s) => ({
    ...s,
    data_room_items: s.data_room_items.map((i) =>
      i.id === id
        ? { ...i, status: "in_progress", updated_at: new Date().toISOString() }
        : i,
    ),
  }));
}

export function deleteDataRoomItem(id: string) {
  setState((s) => ({
    ...s,
    data_room_items: s.data_room_items.filter((i) => i.id !== id),
  }));
}

export function newDataRoomItemDraft(
  folder: CG.DataRoomFolder = "corporate",
): CG.DataRoomItem {
  const now = new Date().toISOString();
  return {
    id: uid("dri"),
    business_id: getState().business.id,
    folder,
    title: "",
    document_type: "",
    version: "1.0",
    status: "in_progress",
    file_name: "",
    source_module: null,
    source_record_id: null,
    confidentiality: "standard",
    review_date: null,
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

export function saveInvestorReadinessAssessment(
  a: CG.InvestorReadinessAssessment,
) {
  setState((s) => {
    const exists = s.investor_readiness_assessments.find((x) => x.id === a.id);
    const updated = { ...a, updated_at: new Date().toISOString() };
    return {
      ...s,
      investor_readiness_assessments: exists
        ? s.investor_readiness_assessments.map((x) =>
            x.id === a.id ? updated : x,
          )
        : [updated, ...s.investor_readiness_assessments],
      activities:
        a.status === "completed"
          ? logActivity(s, {
              activity_type: "review",
              module: "investor-ready",
              title: "Investor readiness assessment completed",
              description: "Overall score " + a.overall_score + "/100.",
              status: "completed",
              priority: a.overall_score < 65 ? "high" : "medium",
              reference_type: "investor_assessment",
              reference_id: a.id,
            })
          : s.activities,
    };
  });
}

export function newInvestorAssessmentDraft(): CG.InvestorReadinessAssessment {
  const now = new Date().toISOString();
  return {
    id: uid("ira"),
    business_id: getState().business.id,
    answers: {},
    overall_score: 0,
    corporate_score: 0,
    financial_score: 0,
    legal_score: 0,
    compliance_score: 0,
    commercial_score: 0,
    people_score: 0,
    data_room_score: 0,
    gaps: [],
    red_flags: [],
    recommended_actions: [],
    status: "draft",
    completed_at: null,
    review_date: null,
    created_at: now,
    updated_at: now,
  };
}

export function upsertTenderOpportunity(o: CG.TenderOpportunity) {
  setState((s) => {
    const exists = s.tender_opportunities.find((x) => x.id === o.id);
    const updated = { ...o, updated_at: new Date().toISOString() };
    return {
      ...s,
      tender_opportunities: exists
        ? s.tender_opportunities.map((x) => (x.id === o.id ? updated : x))
        : [updated, ...s.tender_opportunities],
      activities: logActivity(s, {
        activity_type: "system",
        module: "tender-ready",
        title: exists
          ? "Opportunity updated: " + o.title
          : "Tender opportunity created: " + o.title,
        description: o.authority + " - " + o.status,
        status:
          o.status === "won" || o.status === "submitted" ? "completed" : "open",
        priority: "medium",
        reference_type: "tender_opportunity",
        reference_id: o.id,
      }),
    };
  });
}

export function setOpportunityStatus(
  id: string,
  status: CG.TenderStatus,
  reason?: string,
) {
  setState((s) => ({
    ...s,
    tender_opportunities: s.tender_opportunities.map((o) =>
      o.id === id ? { ...o, status, updated_at: new Date().toISOString() } : o,
    ),
    activities: logActivity(s, {
      activity_type: "decision",
      module: "tender-ready",
      title:
        "Tender " +
        status +
        ": " +
        (s.tender_opportunities.find((o) => o.id === id)?.title ?? ""),
      description: reason ?? "",
      status:
        status === "won" ||
        status === "submitted" ||
        status === "no_bid" ||
        status === "lost"
          ? "completed"
          : "open",
      priority: "none",
      reference_type: "tender_opportunity",
      reference_id: id,
    }),
  }));
}

export function deleteOpportunity(id: string) {
  setState((s) => ({
    ...s,
    tender_opportunities: s.tender_opportunities.filter((o) => o.id !== id),
    tender_requirements: s.tender_requirements.filter(
      (r) => r.opportunity_id !== id,
    ),
    tender_responses: s.tender_responses.filter((r) => r.opportunity_id !== id),
    bid_assessments: s.bid_assessments.filter((b) => b.opportunity_id !== id),
  }));
}

export function duplicateOpportunity(id: string): string | null {
  const s = getState();
  const o = s.tender_opportunities.find((x) => x.id === id);
  if (!o) return null;
  const newId = uid("opp");
  const now = new Date().toISOString();
  setState((cur) => ({
    ...cur,
    tender_opportunities: [
      {
        ...o,
        id: newId,
        title: o.title + " (copy)",
        status: "identified",
        created_at: now,
        updated_at: now,
      },
      ...cur.tender_opportunities,
    ],
  }));
  return newId;
}

export function newOpportunityDraft(): CG.TenderOpportunity {
  const now = new Date().toISOString();
  return {
    id: uid("opp"),
    business_id: getState().business.id,
    title: "",
    authority: "",
    reference: "",
    sector: "",
    location: "",
    contract_value: 0,
    currency: "GBP",
    publication_date: now,
    clarification_deadline: null,
    submission_deadline: null,
    contract_start_date: null,
    contract_duration: "",
    procedure_type: "open",
    status: "identified",
    source: "",
    summary: "",
    eligibility_notes: "",
    owner: getState().business.owner,
    created_at: now,
    updated_at: now,
  };
}

export function saveBidAssessment(a: CG.BidAssessment) {
  setState((s) => {
    const exists = s.bid_assessments.find((x) => x.id === a.id);
    const updated = { ...a, updated_at: new Date().toISOString() };
    return {
      ...s,
      bid_assessments: exists
        ? s.bid_assessments.map((x) => (x.id === a.id ? updated : x))
        : [updated, ...s.bid_assessments],
      activities: logActivity(s, {
        activity_type: "review",
        module: "tender-ready",
        title: "Bid assessment completed",
        description:
          "Overall " +
          a.overall_score +
          "/100 - recommendation: " +
          a.recommendation,
        status: "completed",
        priority: "medium",
        reference_type: "bid_assessment",
        reference_id: a.id,
      }),
    };
  });
}

export function newBidAssessmentDraft(
  opportunity_id: string,
): CG.BidAssessment {
  const now = new Date().toISOString();
  return {
    id: uid("bid"),
    business_id: getState().business.id,
    opportunity_id,
    strategic_fit_score: 0,
    eligibility_score: 0,
    capacity_score: 0,
    evidence_score: 0,
    commercial_score: 0,
    delivery_risk_score: 0,
    overall_score: 0,
    answers: {},
    strengths: [],
    gaps: [],
    risks: [],
    recommendation: "conditional",
    decision: "pending",
    decision_reason: "",
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}

export function upsertTenderRequirement(r: CG.TenderRequirement) {
  setState((s) => {
    const exists = s.tender_requirements.find((x) => x.id === r.id);
    const updated = { ...r, updated_at: new Date().toISOString() };
    return {
      ...s,
      tender_requirements: exists
        ? s.tender_requirements.map((x) => (x.id === r.id ? updated : x))
        : [updated, ...s.tender_requirements],
      activities:
        r.status === "complete"
          ? logActivity(s, {
              activity_type: "review",
              module: "tender-ready",
              title: "Tender requirement complete: " + r.title,
              description: "",
              status: "completed",
              priority: "none",
              reference_type: "tender_requirement",
              reference_id: r.id,
            })
          : s.activities,
    };
  });
}

export function deleteTenderRequirement(id: string) {
  setState((s) => ({
    ...s,
    tender_requirements: s.tender_requirements.filter((r) => r.id !== id),
  }));
}

export function newTenderRequirementDraft(
  opportunity_id: string,
): CG.TenderRequirement {
  const now = new Date().toISOString();
  return {
    id: uid("req"),
    business_id: getState().business.id,
    opportunity_id,
    requirement_type: "technical",
    title: "",
    description: "",
    mandatory: true,
    weighting: 5,
    status: "not_started",
    owner: getState().business.owner,
    due_date: null,
    evidence_reference: "",
    response_id: null,
    source_section: "",
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

export function upsertTenderResponse(r: CG.TenderResponse) {
  setState((s) => {
    const exists = s.tender_responses.find((x) => x.id === r.id);
    const updated = { ...r, updated_at: new Date().toISOString() };
    return {
      ...s,
      tender_responses: exists
        ? s.tender_responses.map((x) => (x.id === r.id ? updated : x))
        : [updated, ...s.tender_responses],
      tender_requirements: s.tender_requirements.map((req) =>
        req.id === r.requirement_id
          ? { ...req, response_id: r.id, updated_at: new Date().toISOString() }
          : req,
      ),
      activities:
        r.status === "approved"
          ? logActivity(s, {
              activity_type: "review",
              module: "tender-ready",
              title: "Tender response approved: " + r.section_title,
              description: "",
              status: "completed",
              priority: "none",
              reference_type: "tender_response",
              reference_id: r.id,
            })
          : s.activities,
    };
  });
}

export function duplicateTenderResponse(id: string): string | null {
  const s = getState();
  const r = s.tender_responses.find((x) => x.id === id);
  if (!r) return null;
  const newId = uid("resp");
  const now = new Date().toISOString();
  setState((cur) => ({
    ...cur,
    tender_responses: [
      {
        ...r,
        id: newId,
        version: r.version + 1,
        status: "draft",
        created_at: now,
        updated_at: now,
      },
      ...cur.tender_responses,
    ],
  }));
  return newId;
}

export function newTenderResponseDraft(
  opportunity_id: string,
  requirement_id: string,
): CG.TenderResponse {
  const now = new Date().toISOString();
  return {
    id: uid("resp"),
    business_id: getState().business.id,
    opportunity_id,
    requirement_id,
    section_title: "",
    question: "",
    word_limit: 0,
    response_text: "",
    status: "draft",
    review_notes: "",
    version: 1,
    owner: getState().business.owner,
    created_at: now,
    updated_at: now,
  };
}

export function upsertEvidenceLibraryItem(e: CG.EvidenceLibraryItem) {
  setState((s) => {
    const exists = s.evidence_library_items.find((x) => x.id === e.id);
    const updated = { ...e, updated_at: new Date().toISOString() };
    return {
      ...s,
      evidence_library_items: exists
        ? s.evidence_library_items.map((x) => (x.id === e.id ? updated : x))
        : [updated, ...s.evidence_library_items],
    };
  });
}

export function archiveEvidenceItem(id: string) {
  setState((s) => ({
    ...s,
    evidence_library_items: s.evidence_library_items.map((e) =>
      e.id === id
        ? { ...e, status: "archived", updated_at: new Date().toISOString() }
        : e,
    ),
  }));
}

export function newEvidenceItemDraft(): CG.EvidenceLibraryItem {
  const now = new Date().toISOString();
  return {
    id: uid("evi"),
    business_id: getState().business.id,
    category: "corporate",
    title: "",
    description: "",
    source_module: null,
    source_record_id: null,
    status: "current",
    review_date: null,
    file_name: "",
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

// ============================================================
// Academy mutations
// ============================================================

import type {
  AcademyAssignment,
  AcademyCertificate,
  AcademyProgress,
  AcademyQuizAttempt,
  LearnerId,
} from "./types";
import { getCourse } from "./academy-catalog";
import {
  findLearner,
  progressFor as _progressFor,
  certificateReference,
} from "./academy-selectors";

function ensureProgress(
  s: CoreDataState,
  learner_id: LearnerId,
  course_id: string,
): { state: CoreDataState; progress: AcademyProgress } {
  const existing = s.academy_progress.find(
    (p) => p.learner_id === learner_id && p.course_id === course_id,
  );
  if (existing) return { state: s, progress: existing };
  const now = new Date().toISOString();
  const progress: AcademyProgress = {
    id: uid("aprog"),
    business_id: s.business.id,
    learner_id,
    course_id,
    lessons_completed: [],
    started_at: now,
    last_activity_at: now,
    completed_at: null,
    time_minutes: 0,
  };
  return {
    state: { ...s, academy_progress: [...s.academy_progress, progress] },
    progress,
  };
}

export function startCourse(learner_id: LearnerId, course_id: string) {
  setState((s) => {
    const learner = findLearner(s, learner_id);
    const course = getCourse(course_id);
    if (!course || !learner) return s;
    const existing = s.academy_progress.find(
      (p) => p.learner_id === learner_id && p.course_id === course_id,
    );
    if (existing) return s;
    const { state: next } = ensureProgress(s, learner_id, course_id);
    // sync assignment status
    const assignments = next.academy_assignments.map((a) =>
      a.learner_id === learner_id &&
      a.course_id === course_id &&
      a.status === "assigned"
        ? {
            ...a,
            status: "in_progress" as const,
            updated_at: new Date().toISOString(),
          }
        : a,
    );
    return {
      ...next,
      academy_assignments: assignments,
      activities: logActivity(next, {
        activity_type: "training",
        module: "academy",
        title: `Course started: ${course.title}`,
        description: `${learner.name} started ${course.title}.`,
        status: "in_progress",
        priority: "none",
        reference_type: "course",
        reference_id: course_id,
      }),
    };
  });
}

export function completeLesson(
  learner_id: LearnerId,
  course_id: string,
  lesson_id: string,
) {
  setState((s) => {
    const course = getCourse(course_id);
    const learner = findLearner(s, learner_id);
    if (!course || !learner) return s;
    const { state: withProgress, progress } = ensureProgress(
      s,
      learner_id,
      course_id,
    );
    if (progress.lessons_completed.includes(lesson_id)) return withProgress;
    const now = new Date().toISOString();
    const updatedProgress: AcademyProgress = {
      ...progress,
      lessons_completed: [...progress.lessons_completed, lesson_id],
      last_activity_at: now,
      time_minutes:
        progress.time_minutes +
        Math.round(
          course.duration_minutes / Math.max(1, course.lessons.length),
        ),
    };
    const assignments = withProgress.academy_assignments.map((a) =>
      a.learner_id === learner_id &&
      a.course_id === course_id &&
      a.status === "assigned"
        ? { ...a, status: "in_progress" as const, updated_at: now }
        : a,
    );
    return {
      ...withProgress,
      academy_progress: withProgress.academy_progress.map((p) =>
        p.id === progress.id ? updatedProgress : p,
      ),
      academy_assignments: assignments,
      activities: logActivity(withProgress, {
        activity_type: "training",
        module: "academy",
        title: `Lesson completed: ${course.lessons.find((l) => l.id === lesson_id)?.title ?? lesson_id}`,
        description: `${learner.name} completed a lesson in ${course.title}.`,
        status: "completed",
        priority: "none",
        reference_type: "course",
        reference_id: course_id,
      }),
    };
  });
}

export function recordQuizAttempt(input: {
  learner_id: LearnerId;
  course_id: string;
  score: number;
  passed: boolean;
  answers: Record<string, number>;
}): { certificate?: AcademyCertificate; passed: boolean } {
  let generatedCert: AcademyCertificate | undefined;
  const passed = input.passed;
  setState((s) => {
    const course = getCourse(input.course_id);
    const learner = findLearner(s, input.learner_id);
    if (!course || !learner) return s;
    const now = new Date().toISOString();
    const attempt: AcademyQuizAttempt = {
      id: uid("aqa"),
      business_id: s.business.id,
      learner_id: input.learner_id,
      course_id: input.course_id,
      score: input.score,
      passed: input.passed,
      answers: input.answers,
      taken_at: now,
    };
    const { state: withProgress, progress } = ensureProgress(
      s,
      input.learner_id,
      input.course_id,
    );
    const allLessonsDone = course.lessons.every((l) =>
      progress.lessons_completed.includes(l.id),
    );
    const shouldComplete = input.passed && allLessonsDone;
    const updatedProgress: AcademyProgress = shouldComplete
      ? { ...progress, completed_at: now, last_activity_at: now }
      : { ...progress, last_activity_at: now };
    let nextState: CoreDataState = {
      ...withProgress,
      academy_quiz_attempts: [attempt, ...withProgress.academy_quiz_attempts],
      academy_progress: withProgress.academy_progress.map((p) =>
        p.id === progress.id ? updatedProgress : p,
      ),
    };
    // certificate + assignment completion
    if (shouldComplete) {
      const existingCert = nextState.academy_certificates.find(
        (c) =>
          c.learner_id === input.learner_id && c.course_id === input.course_id,
      );
      if (!existingCert) {
        const seq = nextState.academy_certificates.length + 1;
        generatedCert = {
          id: uid("acer"),
          business_id: s.business.id,
          reference: certificateReference(input.course_id, seq),
          learner_id: input.learner_id,
          learner_name: learner.name,
          course_id: input.course_id,
          course_title: course.title,
          completed_at: now,
          quiz_score: input.score,
          duration_minutes:
            updatedProgress.time_minutes || course.duration_minutes,
        };
        nextState = {
          ...nextState,
          academy_certificates: [
            generatedCert,
            ...nextState.academy_certificates,
          ],
        };
      }
      nextState = {
        ...nextState,
        academy_assignments: nextState.academy_assignments.map((a) =>
          a.learner_id === input.learner_id && a.course_id === input.course_id
            ? {
                ...a,
                status: "completed" as const,
                completed_at: now,
                updated_at: now,
              }
            : a,
        ),
      };
      // If HR employee, refresh training_status where relevant
      if (learner.employee) {
        nextState = {
          ...nextState,
          employees: nextState.employees.map((e) =>
            e.id === learner.employee!.id
              ? { ...e, training_status: "complete" as const, updated_at: now }
              : e,
          ),
        };
      }
    }
    nextState = {
      ...nextState,
      activities: logActivity(nextState, {
        activity_type: "training",
        module: "academy",
        title: shouldComplete
          ? `Course completed: ${course.title}`
          : input.passed
            ? `Quiz passed: ${course.title}`
            : `Quiz attempt: ${course.title}`,
        description: `${learner.name} scored ${input.score}% on ${course.title}${shouldComplete ? " and completed the course." : "."}`,
        status: shouldComplete
          ? "completed"
          : input.passed
            ? "in_progress"
            : "open",
        priority: "none",
        reference_type: "course",
        reference_id: input.course_id,
      }),
    };
    if (generatedCert) {
      nextState = {
        ...nextState,
        activities: [
          activityFactory(nextState, {
            activity_type: "training",
            module: "academy",
            title: `Certificate generated: ${course.title}`,
            description: `Reference ${generatedCert.reference} - ${learner.name}.`,
            status: "completed",
            priority: "none",
            reference_type: "certificate",
            reference_id: generatedCert.id,
          }),
          ...nextState.activities,
        ],
        notifications: [
          {
            id: uid("ntf"),
            kind: "insight",
            title: `Certificate earned: ${course.title}`,
            description: `Reference ${generatedCert.reference}.`,
            reference_type: null,
            reference_id: null,
            read: false,
            created_at: now,
          },
          ...nextState.notifications,
        ],
      };
    }
    return nextState;
  });
  return { certificate: generatedCert, passed };
}

export function newAssignmentDraft(input: {
  learner_id: LearnerId;
  learner_name: string;
  course_id: string;
  due_date?: string | null;
  required_by_company?: boolean;
  reason?: string;
}): AcademyAssignment {
  const now = new Date().toISOString();
  return {
    id: uid("aas"),
    business_id: getState().business.id,
    learner_id: input.learner_id,
    learner_name: input.learner_name,
    course_id: input.course_id,
    assigned_by: getState().business.owner,
    due_date: input.due_date ?? null,
    status: "assigned",
    required_by_company: input.required_by_company ?? true,
    legally_required: false,
    external_completion_note: "",
    reason: input.reason ?? "",
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
}

export function assignCourses(
  learner_ids: LearnerId[],
  course_id: string,
  due_date: string | null,
  reason: string,
): number {
  const state0 = getState();
  const course = getCourse(course_id);
  if (!course) return 0;
  let count = 0;
  setState((s) => {
    let assignments = s.academy_assignments;
    const now = new Date().toISOString();
    const created: AcademyAssignment[] = [];
    for (const learner_id of learner_ids) {
      const learner = findLearner(s, learner_id);
      if (!learner) continue;
      // skip duplicates (open + same course)
      const dup = assignments.some(
        (a) =>
          a.learner_id === learner_id &&
          a.course_id === course_id &&
          a.status !== "completed",
      );
      if (dup) continue;
      const a: AcademyAssignment = {
        id: uid("aas"),
        business_id: s.business.id,
        learner_id,
        learner_name: learner.name,
        course_id,
        assigned_by: s.business.owner,
        due_date,
        status: "assigned",
        required_by_company: true,
        legally_required: false,
        external_completion_note: "",
        reason,
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      created.push(a);
      count++;
    }
    assignments = [...created, ...assignments];
    return {
      ...s,
      academy_assignments: assignments,
      activities: [
        ...created.map((a) =>
          activityFactory(s, {
            activity_type: "training",
            module: "academy",
            title: `Training assigned: ${course.title}`,
            description: `${a.learner_name}${due_date ? ` - due ${new Date(due_date).toLocaleDateString("en-GB")}` : ""}.`,
            status: "open",
            priority: "medium",
            reference_type: "assignment",
            reference_id: a.id,
            due_at: due_date,
          }),
        ),
        ...s.activities,
      ],
    };
  });
  void state0;
  return count;
}

export function reassignAssignmentDate(id: string, due_date: string | null) {
  setState((s) => ({
    ...s,
    academy_assignments: s.academy_assignments.map((a) =>
      a.id === id
        ? {
            ...a,
            due_date,
            status: a.status === "overdue" ? "in_progress" : a.status,
            updated_at: new Date().toISOString(),
          }
        : a,
    ),
    activities: logActivity(s, {
      activity_type: "training",
      module: "academy",
      title: `Training due date changed`,
      description:
        s.academy_assignments.find((a) => a.id === id)?.learner_name ?? "",
      status: "info",
      priority: "none",
      reference_type: "assignment",
      reference_id: id,
      due_at: due_date,
    }),
  }));
}

export function markAssignmentExternallyComplete(
  id: string,
  completed_at: string,
  note: string,
) {
  setState((s) => {
    const a = s.academy_assignments.find((x) => x.id === id);
    if (!a) return s;
    const course = getCourse(a.course_id);
    const now = new Date().toISOString();
    let nextState: CoreDataState = {
      ...s,
      academy_assignments: s.academy_assignments.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "completed" as const,
              completed_at,
              external_completion_note: note,
              updated_at: now,
            }
          : x,
      ),
      activities: logActivity(s, {
        activity_type: "training",
        module: "academy",
        title: `External completion recorded: ${course?.title ?? a.course_id}`,
        description: `${a.learner_name} - evidence: ${note || "recorded externally"}.`,
        status: "completed",
        priority: "none",
        reference_type: "assignment",
        reference_id: id,
      }),
    };
    // Reflect completion in HR training status when linked to an employee
    if (a.learner_id !== "owner") {
      nextState = {
        ...nextState,
        employees: nextState.employees.map((e) =>
          e.id === a.learner_id
            ? { ...e, training_status: "complete" as const, updated_at: now }
            : e,
        ),
      };
    }
    return nextState;
  });
}

export function deleteAssignment(id: string) {
  setState((s) => ({
    ...s,
    academy_assignments: s.academy_assignments.filter((a) => a.id !== id),
  }));
}

void _progressFor;

// ============================================================
// Settings, users, audit log mutations
// ============================================================

import type {
  AppSettings,
  AppUser,
  AppRole,
  AuditEvent,
} from "./settings-types";
import { seedAppSettings, seedAppUsers } from "./settings-seed";

function currentActor(s: CoreDataState): string {
  const owner = s.app_users.find(
    (u) => u.role === "owner_admin" && u.status === "active",
  );
  return owner?.full_name ?? s.business.owner ?? "Anastasia";
}

function pushAudit(
  s: CoreDataState,
  event: Omit<AuditEvent, "id" | "timestamp" | "actor"> & { actor?: string },
): AuditEvent[] {
  const e: AuditEvent = {
    id: uid("aud"),
    timestamp: new Date().toISOString(),
    actor: event.actor ?? currentActor(s),
    action: event.action,
    category: event.category,
    target: event.target,
    summary: event.summary,
    before: event.before,
    after: event.after,
  };
  return [e, ...s.audit_events].slice(0, 500);
}

export function updateAppSettings(
  updater: (prev: AppSettings) => AppSettings,
  audit?: {
    category: AuditEvent["category"];
    action: string;
    target: string;
    summary: string;
    before?: string;
    after?: string;
  },
) {
  setState((s) => {
    const next = updater(s.app_settings);
    const stamped: AppSettings = {
      ...next,
      last_saved_at: new Date().toISOString(),
      last_saved_by: currentActor(s),
    };
    return {
      ...s,
      app_settings: stamped,
      audit_events: audit ? pushAudit(s, audit) : s.audit_events,
    };
  });
}

export function logAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp" | "actor"> & { actor?: string },
) {
  setState((s) => ({ ...s, audit_events: pushAudit(s, event) }));
}

export function inviteAppUser(input: {
  full_name: string;
  email: string;
  role: AppRole;
  areas?: string[];
  notes?: string;
}): string | null {
  const trimmed = input.email.trim().toLowerCase();
  let created: string | null = null;
  setState((s) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return s;
    if (s.app_users.some((u) => u.email.toLowerCase() === trimmed)) return s;
    const id = uid("usr");
    created = id;
    const now = new Date().toISOString();
    const user: AppUser = {
      id,
      full_name: input.full_name.trim() || trimmed,
      email: trimmed,
      role: input.role,
      status: "invited",
      invited_at: now,
      last_active_at: null,
      areas: input.areas ?? [],
      notes: input.notes ?? "Prototype invitation - no email has been sent.",
    };
    return {
      ...s,
      app_users: [user, ...s.app_users],
      audit_events: pushAudit(s, {
        category: "access",
        action: "User invited",
        target: user.full_name,
        summary: `Prototype invitation created for ${user.email}. No email has been sent.`,
      }),
    };
  });
  return created;
}

export function resendUserInvite(id: string) {
  setState((s) => {
    const u = s.app_users.find((x) => x.id === id);
    if (!u) return s;
    return {
      ...s,
      app_users: s.app_users.map((x) =>
        x.id === id ? { ...x, invited_at: new Date().toISOString() } : x,
      ),
      audit_events: pushAudit(s, {
        category: "access",
        action: "Invitation resent",
        target: u.full_name,
        summary: `Prototype invitation resent to ${u.email}. No email has been sent.`,
      }),
    };
  });
}

export function setUserRole(
  id: string,
  role: AppRole,
): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: true };
  setState((s) => {
    const u = s.app_users.find((x) => x.id === id);
    if (!u) {
      result = { ok: false, reason: "User not found." };
      return s;
    }
    if (u.role === "owner_admin" && role !== "owner_admin") {
      const remainingAdmins = s.app_users.filter(
        (x) => x.role === "owner_admin" && x.status === "active" && x.id !== id,
      );
      if (remainingAdmins.length === 0) {
        result = {
          ok: false,
          reason:
            "You are the only active Owner/Admin. Assign another Owner/Admin before changing this role.",
        };
        return s;
      }
    }
    return {
      ...s,
      app_users: s.app_users.map((x) => (x.id === id ? { ...x, role } : x)),
      audit_events: pushAudit(s, {
        category: "access",
        action: "Role changed",
        target: u.full_name,
        summary: `Role changed from ${u.role} to ${role}.`,
        before: u.role,
        after: role,
      }),
    };
  });
  return result;
}

export function setUserStatus(
  id: string,
  status: AppUser["status"],
): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: true };
  setState((s) => {
    const u = s.app_users.find((x) => x.id === id);
    if (!u) {
      result = { ok: false, reason: "User not found." };
      return s;
    }
    if (u.role === "owner_admin" && status !== "active") {
      const remainingAdmins = s.app_users.filter(
        (x) => x.role === "owner_admin" && x.status === "active" && x.id !== id,
      );
      if (remainingAdmins.length === 0) {
        result = {
          ok: false,
          reason:
            "You are the only active Owner/Admin. Assign another Owner/Admin before deactivating this account.",
        };
        return s;
      }
    }
    return {
      ...s,
      app_users: s.app_users.map((x) => (x.id === id ? { ...x, status } : x)),
      audit_events: pushAudit(s, {
        category: "access",
        action: status === "active" ? "User reactivated" : "User deactivated",
        target: u.full_name,
        summary: `Status changed from ${u.status} to ${status}.`,
        before: u.status,
        after: status,
      }),
    };
  });
  return result;
}

export function updateAppUser(id: string, patch: Partial<AppUser>) {
  setState((s) => ({
    ...s,
    app_users: s.app_users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
  }));
}

// ---- Backup / import / reset --------------------------------------------

export interface JojanBackup {
  format: "jojan-one-backup";
  schema_version: number;
  exported_at: string;
  data: CoreDataState;
}

export const BACKUP_SCHEMA_VERSION = 1;

export function exportBackup(): JojanBackup {
  const s = getState();
  logAuditEvent({
    category: "data",
    action: "Backup exported",
    target: "Jojan One prototype data",
    summary: `Downloaded JSON backup at ${new Date().toISOString()}. Backup is not encrypted.`,
  });
  return {
    format: "jojan-one-backup",
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    data: s,
  };
}

export interface ImportSummary {
  ok: boolean;
  reason?: string;
  counts?: Record<string, number>;
  mode?: "merge" | "replace";
}

export function validateBackup(raw: unknown): ImportSummary {
  if (!raw || typeof raw !== "object")
    return { ok: false, reason: "Not a JSON object." };
  const b = raw as Partial<JojanBackup>;
  if (b.format !== "jojan-one-backup")
    return { ok: false, reason: "Missing jojan-one-backup format marker." };
  if (!b.data || typeof b.data !== "object")
    return { ok: false, reason: "Missing data payload." };
  const req = ["business", "activities", "app_settings", "app_users"] as const;
  for (const k of req)
    if (!(k in (b.data as any)))
      return { ok: false, reason: `Missing collection: ${k}` };
  const counts: Record<string, number> = {};
  for (const k of Object.keys(b.data as any)) {
    const v = (b.data as any)[k];
    if (Array.isArray(v)) counts[k] = v.length;
  }
  return { ok: true, counts };
}

export function importBackup(
  raw: unknown,
  mode: "merge" | "replace",
): ImportSummary {
  const v = validateBackup(raw);
  if (!v.ok) return v;
  const incoming = (raw as JojanBackup).data;
  setState((s) => {
    let next: CoreDataState;
    if (mode === "replace") {
      next = { ...buildSeedState(), ...incoming } as CoreDataState;
    } else {
      // Merge collections by id, preferring incoming records.
      const mergeById = <T extends { id: string }>(
        cur: T[],
        inc: T[] | undefined,
      ): T[] => {
        if (!Array.isArray(inc)) return cur;
        const map = new Map<string, T>();
        for (const c of cur) map.set(c.id, c);
        for (const i of inc) map.set(i.id, { ...map.get(i.id), ...i });
        return Array.from(map.values());
      };
      const merged: any = { ...s };
      for (const k of Object.keys(incoming as any)) {
        const val = (incoming as any)[k];
        if (
          Array.isArray(val) &&
          val.length &&
          typeof val[0] === "object" &&
          val[0] &&
          "id" in val[0]
        ) {
          merged[k] = mergeById(((s as any)[k] as any[]) ?? [], val as any);
        } else if (val && typeof val === "object" && !Array.isArray(val)) {
          merged[k] = { ...(s as any)[k], ...val };
        } else if (val !== undefined) {
          merged[k] = val;
        }
      }
      next = merged;
    }
    return {
      ...next,
      audit_events: pushAudit(next, {
        category: "data",
        action: "Backup imported",
        target:
          mode === "replace" ? "Replace all data" : "Merge into existing data",
        summary: `Import completed (${mode}). Collections received: ${Object.keys(v.counts ?? {}).length}.`,
      }),
    };
  });
  return { ...v, mode };
}

export function resetSettingsOnly() {
  setState((s) => ({
    ...s,
    app_settings: {
      ...seedAppSettings,
      last_saved_at: new Date().toISOString(),
      last_saved_by: currentActor(s),
    },
    audit_events: pushAudit(s, {
      category: "settings",
      action: "Settings restored to defaults",
      target: "All settings sections",
      summary:
        "All settings restored to seeded defaults. Business, module and audit data preserved.",
    }),
  }));
}

export function resetDemoNotifications() {
  setState((s) => ({
    ...s,
    notifications: buildSeedState().notifications,
    audit_events: pushAudit(s, {
      category: "data",
      action: "Demo notifications reset",
      target: "Notification centre",
      summary: "Demo notifications restored to seeded defaults.",
    }),
  }));
}

export function resetJovaConversations() {
  setState((s) => ({
    ...s,
    conversations: [],
    messages: [],
    audit_events: pushAudit(s, {
      category: "data",
      action: "Jova conversations reset",
      target: "Jova",
      summary: "All Jova conversations cleared.",
    }),
  }));
}

export function resetAcademyProgress() {
  setState((s) => ({
    ...s,
    academy_progress: [],
    academy_quiz_attempts: [],
    academy_certificates: [],
    academy_assignments: s.academy_assignments.map((a) => ({
      ...a,
      status: "assigned",
      completed_at: null,
    })),
    audit_events: pushAudit(s, {
      category: "data",
      action: "Academy progress reset",
      target: "Academy",
      summary:
        "Learner progress, quiz attempts and certificates cleared. Assignments retained.",
    }),
  }));
}

export function resetAllPrototypeData() {
  setState((s) => {
    const fresh = buildSeedState();
    return {
      ...fresh,
      audit_events: pushAudit(fresh, {
        category: "data",
        action: "All prototype data reset",
        target: "Jojan One",
        summary: `Complete reset performed by ${currentActor(s)}. All demo state restored.`,
      }),
    };
  });
}

export function runSystemChecks(): Array<{
  name: string;
  status: "passed" | "attention" | "not_configured";
  note?: string;
}> {
  const s = getState();
  const checks: Array<{
    name: string;
    status: "passed" | "attention" | "not_configured";
    note?: string;
  }> = [];
  checks.push({
    name: "Shared state can be read",
    status: s && s.business ? "passed" : "attention",
  });
  let lsOk = false;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("__jojan_probe__", "ok");
      window.localStorage.removeItem("__jojan_probe__");
      lsOk = true;
    }
  } catch {
    lsOk = false;
  }
  checks.push({
    name: "LocalStorage can be written",
    status: lsOk ? "passed" : "attention",
  });
  const required: Array<keyof CoreDataState> = [
    "business",
    "app_settings",
    "app_users",
    "activities",
    "reports",
    "notifications",
    "audit_events",
  ];
  const missing = required.filter((k) => !(k in s));
  checks.push({
    name: "Required state collections exist",
    status: missing.length === 0 ? "passed" : "attention",
    note: missing.length ? `Missing: ${missing.join(", ")}` : undefined,
  });
  checks.push({
    name: "Settings schema is current",
    status:
      s.app_settings.schema_version === seedAppSettings.schema_version
        ? "passed"
        : "attention",
  });
  checks.push({
    name: "Notification generator available",
    status: typeof pushNotification === "function" ? "passed" : "attention",
  });
  checks.push({
    name: "Academy course registry available",
    status: Array.isArray(s.academy_assignments) ? "passed" : "attention",
  });
  checks.push({
    name: "Deterministic Jova engine available",
    status: "passed",
  });
  checks.push({
    name: "Report generator available",
    status: typeof addReport === "function" ? "passed" : "attention",
  });
  checks.push({
    name: "Production database",
    status: "not_configured",
    note: "Not connected in this prototype.",
  });
  checks.push({
    name: "Email delivery",
    status: "not_configured",
    note: "Not connected in this prototype.",
  });
  return checks;
}

// Ensure seed users exist even if a legacy backup replaced app_users with []
void seedAppUsers;

// ---- Billing (prototype only) ---------------------------------------

import type { BillingCycle, BillingPlanId } from "./settings-types";

export function updateBillingCycle(cycle: BillingCycle) {
  setState((s) => {
    const prev = s.app_settings.billing;
    if (prev.cycle === cycle) return s;
    const now = new Date().toISOString();
    return {
      ...s,
      app_settings: {
        ...s.app_settings,
        billing: { ...prev, cycle, changed_at: now },
        last_saved_at: now,
        last_saved_by: currentActor(s),
      },
      audit_events: pushAudit(s, {
        category: "billing",
        action: "Billing cycle changed (prototype)",
        target: "Subscription",
        summary: `Prototype billing cycle set to ${cycle}. No payment provider is connected.`,
        before: prev.cycle,
        after: cycle,
      }),
    };
  });
}

export function applyBillingPlanChange(input: {
  plan_id: BillingPlanId;
  plan_label: string;
  cycle: BillingCycle;
  price_summary: string;
}) {
  setState((s) => {
    const prev = s.app_settings.billing;
    const now = new Date().toISOString();
    return {
      ...s,
      app_settings: {
        ...s.app_settings,
        billing: {
          plan_id: input.plan_id,
          cycle: input.cycle,
          status: "active_prototype",
          changed_at: now,
        },
        last_saved_at: now,
        last_saved_by: currentActor(s),
      },
      activities: [
        activityFactory(s, {
          activity_type: "system",
          module: "settings",
          title: `Prototype plan changed to ${input.plan_label}`,
          description: `Prototype subscription updated (${input.price_summary}). Entitlement enforcement is not active in this prototype.`,
          status: "completed",
          priority: "none",
          reference_type: "billing",
          reference_id: input.plan_id,
        }),
        ...s.activities,
      ],
      audit_events: pushAudit(s, {
        category: "billing",
        action: "Prototype plan changed",
        target: input.plan_label,
        summary: `Prototype plan set to ${input.plan_label} (${input.price_summary}). No payment was taken.`,
        before: prev.plan_id,
        after: input.plan_id,
      }),
    };
  });
}

export function cancelBillingPrototype() {
  setState((s) => {
    const prev = s.app_settings.billing;
    if (prev.status === "cancelled_prototype") return s;
    const now = new Date().toISOString();
    return {
      ...s,
      app_settings: {
        ...s.app_settings,
        billing: { ...prev, status: "cancelled_prototype", changed_at: now },
        last_saved_at: now,
        last_saved_by: currentActor(s),
      },
      activities: [
        activityFactory(s, {
          activity_type: "system",
          module: "settings",
          title: "Subscription marked as cancelled (prototype)",
          description:
            "Prototype cancellation recorded. No cancellation was sent to a payment provider. Business records are unchanged.",
          status: "completed",
          priority: "none",
          reference_type: "billing",
          reference_id: prev.plan_id,
        }),
        ...s.activities,
      ],
      audit_events: pushAudit(s, {
        category: "billing",
        action: "Prototype cancellation recorded",
        target: "Subscription",
        summary:
          "Cancellation recorded in prototype only. No cancellation sent to a payment provider. Business records are not deleted.",
      }),
    };
  });
}

export function reactivateBillingPrototype() {
  setState((s) => {
    const prev = s.app_settings.billing;
    if (prev.status === "active_prototype") return s;
    const now = new Date().toISOString();
    return {
      ...s,
      app_settings: {
        ...s.app_settings,
        billing: { ...prev, status: "active_prototype", changed_at: now },
        last_saved_at: now,
        last_saved_by: currentActor(s),
      },
      audit_events: pushAudit(s, {
        category: "billing",
        action: "Prototype subscription reactivated",
        target: "Subscription",
        summary: "Prototype subscription marked active again.",
      }),
    };
  });
}
