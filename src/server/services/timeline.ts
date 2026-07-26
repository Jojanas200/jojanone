import { desc, isNull } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  activities,
  complianceObligations,
  contracts,
  employees,
  governanceRecords,
  processingActivities,
  risks,
  tenderOpportunities,
} from "../db/schema";
import { getUserEmails } from "./members";

// Timeline - a unified, chronological feed of every dated event already in the
// database. Read-only: it merges due-dates, renewals, reviews and deadlines
// from the live modules into one sorted stream. Runs inside one withUser()
// transaction, so it only ever sees the caller's workspace (RLS).

export type TimelineModule =
  | "compliance"
  | "contracts"
  | "risk"
  | "hr"
  | "gdpr"
  | "governance"
  | "tender-ready";

export interface TimelineEvent {
  id: string;
  date: string; // YYYY-MM-DD
  module: TimelineModule;
  kind: string;
  title: string;
  href: string;
}

const push = (
  out: TimelineEvent[],
  date: string | null,
  ev: Omit<TimelineEvent, "date">,
) => {
  if (date) out.push({ ...ev, date });
};

export function getTimeline(claims: UserClaims): Promise<TimelineEvent[]> {
  return withUser(claims, async (tx) => {
    const [obs, con, rsk, emp, roc, gov, ten] = await Promise.all([
      tx
        .select({
          id: complianceObligations.id,
          title: complianceObligations.title,
          dueDate: complianceObligations.dueDate,
          status: complianceObligations.status,
        })
        .from(complianceObligations)
        .where(isNull(complianceObligations.deletedAt)),
      tx
        .select({
          id: contracts.id,
          title: contracts.title,
          endDate: contracts.endDate,
          renewalDate: contracts.renewalDate,
        })
        .from(contracts)
        .where(isNull(contracts.deletedAt)),
      tx
        .select({
          id: risks.id,
          title: risks.riskTitle,
          reviewDate: risks.reviewDate,
          status: risks.status,
        })
        .from(risks)
        .where(isNull(risks.deletedAt)),
      tx
        .select({
          id: employees.id,
          name: employees.fullName,
          nextReviewDate: employees.nextReviewDate,
          rtwExpiry: employees.rightToWorkExpiry,
          status: employees.employmentStatus,
        })
        .from(employees)
        .where(isNull(employees.deletedAt)),
      tx
        .select({
          id: processingActivities.id,
          name: processingActivities.activityName,
          reviewDate: processingActivities.reviewDate,
        })
        .from(processingActivities),
      tx
        .select({
          id: governanceRecords.id,
          title: governanceRecords.title,
          meetingDate: governanceRecords.meetingDate,
          decisionDate: governanceRecords.decisionDate,
          reviewDate: governanceRecords.reviewDate,
        })
        .from(governanceRecords),
      tx
        .select({
          id: tenderOpportunities.id,
          title: tenderOpportunities.title,
          submissionDeadline: tenderOpportunities.submissionDeadline,
        })
        .from(tenderOpportunities),
    ]);

    const out: TimelineEvent[] = [];

    for (const o of obs) {
      if (o.status === "completed" || o.status === "not_applicable") continue;
      push(out, o.dueDate, {
        id: `ob-${o.id}`,
        module: "compliance",
        kind: "Obligation due",
        title: o.title,
        href: "/compliance",
      });
    }
    for (const c of con) {
      push(out, c.renewalDate, {
        id: `co-r-${c.id}`,
        module: "contracts",
        kind: "Renewal due",
        title: c.title,
        href: "/contracts",
      });
      push(out, c.endDate, {
        id: `co-e-${c.id}`,
        module: "contracts",
        kind: "Contract ends",
        title: c.title,
        href: "/contracts",
      });
    }
    for (const r of rsk) {
      if (r.status !== "open") continue;
      push(out, r.reviewDate, {
        id: `rk-${r.id}`,
        module: "risk",
        kind: "Risk review",
        title: r.title,
        href: "/risk",
      });
    }
    for (const e of emp) {
      if (e.status === "archived") continue;
      push(out, e.nextReviewDate, {
        id: `hr-r-${e.id}`,
        module: "hr",
        kind: "People review",
        title: e.name,
        href: "/hr",
      });
      push(out, e.rtwExpiry, {
        id: `hr-w-${e.id}`,
        module: "hr",
        kind: "Right-to-work expiry",
        title: e.name,
        href: "/hr",
      });
    }
    for (const a of roc) {
      push(out, a.reviewDate, {
        id: `pa-${a.id}`,
        module: "gdpr",
        kind: "ROPA review",
        title: a.name,
        href: "/gdpr",
      });
    }
    for (const g of gov) {
      push(out, g.meetingDate, {
        id: `gv-m-${g.id}`,
        module: "governance",
        kind: "Meeting",
        title: g.title,
        href: "/governance",
      });
      push(out, g.decisionDate, {
        id: `gv-d-${g.id}`,
        module: "governance",
        kind: "Decision",
        title: g.title,
        href: "/governance",
      });
      push(out, g.reviewDate, {
        id: `gv-r-${g.id}`,
        module: "governance",
        kind: "Governance review",
        title: g.title,
        href: "/governance",
      });
    }
    for (const t of ten) {
      push(out, t.submissionDeadline, {
        id: `tn-${t.id}`,
        module: "tender-ready",
        kind: "Tender deadline",
        title: t.title,
        href: "/tender-ready",
      });
    }

    // Newest first.
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  });
}

// --- Activity feed -----------------------------------------------------------
// The historical spine of the Timeline: every recorded activity (created,
// updated, completed, status change) in reverse-chronological order, with the
// acting user resolved to an email. RLS-scoped, so it only returns the caller's
// workspace. The acting user is resolved with the service role (same pattern as
// the platform audit log), over ids that already appear in RLS-visible rows.

export interface ActivityFeedItem {
  id: string;
  activityType: string;
  module: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  completedAt: string | null;
  dueAt: string | null;
  actorEmail: string | null;
}

export async function getActivityFeed(
  claims: UserClaims,
  limit = 250,
): Promise<ActivityFeedItem[]> {
  const rows = await withUser(claims, (tx) =>
    tx
      .select({
        id: activities.id,
        activityType: activities.activityType,
        module: activities.module,
        title: activities.title,
        description: activities.description,
        status: activities.status,
        priority: activities.priority,
        referenceType: activities.referenceType,
        referenceId: activities.referenceId,
        createdAt: activities.createdAt,
        completedAt: activities.completedAt,
        dueAt: activities.dueAt,
        actorUserId: activities.actorUserId,
      })
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit),
  );

  const emails = await getUserEmails(
    rows.map((r) => r.actorUserId).filter((x): x is string => !!x),
  );

  return rows.map((r) => ({
    id: r.id,
    activityType: r.activityType,
    module: r.module,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    actorEmail: r.actorUserId ? (emails[r.actorUserId] ?? null) : null,
  }));
}
