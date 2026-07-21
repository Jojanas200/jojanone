import type {
  Activity,
  BusinessSnapshot,
  ConfidenceFactor,
  CoreDataState,
  Priority,
} from "./types";

const MS_DAY = 86400000;

export function isOverdue(a: Activity, now = Date.now()) {
  if (a.status === "completed") return false;
  if (!a.due_at) return false;
  return new Date(a.due_at).getTime() < now;
}

export function isUpcoming(a: Activity, now = Date.now()) {
  if (a.status === "completed") return false;
  if (!a.due_at) return false;
  const t = new Date(a.due_at).getTime();
  return t >= now && t - now <= 30 * MS_DAY;
}

export function isOpen(a: Activity) {
  return (
    a.status === "open" ||
    a.status === "in_progress" ||
    a.status === "overdue" ||
    a.status === "upcoming"
  );
}

export function completedThisMonth(activities: Activity[], now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  return activities.filter((a) => {
    if (!a.completed_at) return false;
    const d = new Date(a.completed_at);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export function computeSnapshot(state: CoreDataState): BusinessSnapshot {
  const now = new Date(state.last_refreshed).getTime();
  const openPriorities = state.activities.filter(
    (a) => isOpen(a) && a.priority !== "none" && a.priority !== "low",
  );
  const overdue = state.activities.filter((a) => isOverdue(a, now));
  const upcoming = state.activities.filter((a) => isUpcoming(a, now));
  const completedMonth = completedThisMonth(state.activities);
  const risks = state.activities.filter(
    (a) => a.module === "risk" && isOpen(a),
  );
  const highRisks = risks.filter((a) => a.priority === "high");

  const factors: ConfidenceFactor[] = state.areas.map((area) => ({
    label: area.label,
    score: area.score,
    weight: 1,
    note: area.summary,
    module: area.module,
  }));

  const baseAvg = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) /
      factors.reduce((s, f) => s + f.weight, 0),
  );
  // Penalties for overdue / high-priority open items
  const penalty =
    overdue.length * 3 +
    openPriorities.filter((a) => a.priority === "high").length * 2;
  const score = Math.max(0, Math.min(100, baseAvg - penalty));

  const status_label: BusinessSnapshot["status_label"] =
    score >= 80 ? "Good" : score >= 65 ? "Needs Attention" : "At Risk";

  const compliance_position: BusinessSnapshot["compliance_position"] =
    overdue.some((a) => a.module === "compliance")
      ? "Minor gaps"
      : upcoming.some((a) => a.module === "compliance")
        ? "Minor gaps"
        : "On track";

  const explanation =
    overdue.length > 0
      ? `${overdue.length} overdue item${overdue.length === 1 ? "" : "s"} is holding your score below its ceiling. Clearing those would move you back toward the mid-80s.`
      : "No overdue items. Your score reflects strong coverage across the six business areas.";

  return {
    score,
    status_label,
    change: 4,
    explanation,
    open_priorities: openPriorities.length,
    overdue_actions: overdue.length,
    upcoming_actions: upcoming.length,
    completed_this_month: completedMonth.length,
    active_risks: risks.length,
    high_priority_risks: highRisks.length,
    compliance_position,
    last_updated: state.last_refreshed,
    factors,
  };
}

export function topPriorities(state: CoreDataState, limit = 4): Activity[] {
  const rank: Record<Priority, number> = {
    high: 0,
    medium: 1,
    low: 2,
    none: 3,
  };
  return [...state.activities]
    .filter((a) => isOpen(a) && a.priority !== "none")
    .sort((a, b) => {
      if (rank[a.priority] !== rank[b.priority])
        return rank[a.priority] - rank[b.priority];
      const ad = a.due_at
        ? new Date(a.due_at).getTime()
        : Number.POSITIVE_INFINITY;
      const bd = b.due_at
        ? new Date(b.due_at).getTime()
        : Number.POSITIVE_INFINITY;
      return ad - bd;
    })
    .slice(0, limit);
}

export function recentActivity(state: CoreDataState, limit = 8): Activity[] {
  return [...state.activities]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit);
}

export function formatRelative(iso: string, now = new Date()) {
  const then = new Date(iso).getTime();
  const diff = now.getTime() - then;
  const abs = Math.abs(diff);
  const dir = diff >= 0 ? "ago" : "from now";
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ${dir}`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ${dir}`;
  const days = Math.round(abs / 86_400_000);
  if (days < 30) return `${days}d ${dir}`;
  const months = Math.round(days / 30);
  return `${months}mo ${dir}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
