import {
  and,
  eq,
  gte,
  isNull,
  lte,
  or,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { adminDb } from "../db/admin";
import {
  academyAssignments,
  complianceObligations,
  contracts,
  employees,
  notifications,
  processingActivities,
  risks,
  tenderOpportunities,
  workspaces,
} from "../db/schema";
import { getCourse } from "../../data/academy-catalog";

// Reminder engine. Scans a workspace's dated items within a lead-time window
// and generates in-app notification rows - idempotently: one active reminder
// per source item (workspace_id, reference_type, reference_id). Runs with
// adminDb (service role) so the cron can process every workspace with no user
// session; all queries filter by workspace_id explicitly (RLS is bypassed).

const HORIZON_DAYS = 30;

type Kind = "priority" | "insight" | "risk";
interface Candidate {
  kind: Kind;
  title: string;
  description: string;
  referenceType: string;
  referenceId: string;
}

const dstr = (d: Date) => d.toISOString().slice(0, 10);

export async function generateReminders(
  workspaceId: string,
  opts?: { today?: string; horizonDays?: number },
): Promise<number> {
  const today = opts?.today ?? dstr(new Date());
  const horizonDate = new Date(`${today}T00:00:00Z`);
  horizonDate.setUTCDate(
    horizonDate.getUTCDate() + (opts?.horizonDays ?? HORIZON_DAYS),
  );
  const horizon = dstr(horizonDate);

  const candidates: Candidate[] = [];
  const inWindow = (col: AnyColumn) => and(gte(col, today), lte(col, horizon));

  // --- Compliance: due within window OR overdue ----------------------------
  const obs = await adminDb
    .select({
      id: complianceObligations.id,
      title: complianceObligations.title,
      dueDate: complianceObligations.dueDate,
      status: complianceObligations.status,
    })
    .from(complianceObligations)
    .where(
      and(
        eq(complianceObligations.workspaceId, workspaceId),
        isNull(complianceObligations.deletedAt),
        or(
          inWindow(complianceObligations.dueDate),
          and(
            lte(complianceObligations.dueDate, today),
            sql`${complianceObligations.status} not in ('completed','not_applicable')`,
          ),
        ),
      ),
    );
  for (const o of obs) {
    const overdue = !!o.dueDate && o.dueDate < today;
    candidates.push({
      kind: "priority",
      title: `${overdue ? "Overdue" : "Due soon"}: ${o.title}`,
      description: `Compliance obligation due ${o.dueDate}.`,
      referenceType: "compliance",
      referenceId: o.id,
    });
  }

  // --- Contracts: renewal or end date in window ----------------------------
  const cons = await adminDb
    .select({
      id: contracts.id,
      title: contracts.title,
      endDate: contracts.endDate,
      renewalDate: contracts.renewalDate,
    })
    .from(contracts)
    .where(
      and(
        eq(contracts.workspaceId, workspaceId),
        isNull(contracts.deletedAt),
        sql`${contracts.status} not in ('archived','expired')`,
        or(inWindow(contracts.endDate), inWindow(contracts.renewalDate)),
      ),
    );
  for (const c of cons) {
    const when = c.renewalDate ?? c.endDate;
    candidates.push({
      kind: "priority",
      title: `Renewal due soon: ${c.title}`,
      description: `Contract renewal/expiry on ${when}.`,
      referenceType: "contracts",
      referenceId: c.id,
    });
  }

  // --- Risk: review date in window (open) ----------------------------------
  const rsk = await adminDb
    .select({
      id: risks.id,
      title: risks.riskTitle,
      reviewDate: risks.reviewDate,
    })
    .from(risks)
    .where(
      and(
        eq(risks.workspaceId, workspaceId),
        isNull(risks.deletedAt),
        eq(risks.status, "open"),
        inWindow(risks.reviewDate),
      ),
    );
  for (const r of rsk)
    candidates.push({
      kind: "risk",
      title: `Risk review due: ${r.title}`,
      description: `Scheduled review on ${r.reviewDate}.`,
      referenceType: "risk",
      referenceId: r.id,
    });

  // --- GDPR: ROPA review date in window ------------------------------------
  const roc = await adminDb
    .select({
      id: processingActivities.id,
      name: processingActivities.activityName,
      reviewDate: processingActivities.reviewDate,
    })
    .from(processingActivities)
    .where(
      and(
        eq(processingActivities.workspaceId, workspaceId),
        inWindow(processingActivities.reviewDate),
      ),
    );
  for (const a of roc)
    candidates.push({
      kind: "insight",
      title: `Data review due: ${a.name}`,
      description: `Processing-activity review on ${a.reviewDate}.`,
      referenceType: "gdpr",
      referenceId: a.id,
    });

  // --- HR: right-to-work expiry in window or past (active) -----------------
  const emp = await adminDb
    .select({
      id: employees.id,
      name: employees.fullName,
      rtwExpiry: employees.rightToWorkExpiry,
    })
    .from(employees)
    .where(
      and(
        eq(employees.workspaceId, workspaceId),
        isNull(employees.deletedAt),
        sql`${employees.employmentStatus} <> 'archived'`,
        sql`${employees.rightToWorkExpiry} is not null and ${employees.rightToWorkExpiry} <= ${horizon}`,
      ),
    );
  for (const e of emp)
    candidates.push({
      kind: "risk",
      title: `Right-to-work expiring: ${e.name}`,
      description: `Right-to-work valid until ${e.rtwExpiry}.`,
      referenceType: "hr",
      referenceId: e.id,
    });

  // --- Tender: submission deadline in window -------------------------------
  const ten = await adminDb
    .select({
      id: tenderOpportunities.id,
      title: tenderOpportunities.title,
      deadline: tenderOpportunities.submissionDeadline,
    })
    .from(tenderOpportunities)
    .where(
      and(
        eq(tenderOpportunities.workspaceId, workspaceId),
        sql`${tenderOpportunities.status} not in ('won','lost','no_bid','archived')`,
        inWindow(tenderOpportunities.submissionDeadline),
      ),
    );
  for (const t of ten)
    candidates.push({
      kind: "priority",
      title: `Tender deadline: ${t.title}`,
      description: `Submission due ${t.deadline}.`,
      referenceType: "tender-ready",
      referenceId: t.id,
    });

  // --- Academy: due within window or overdue (not completed) ---------------
  const aca = await adminDb
    .select({
      id: academyAssignments.id,
      courseId: academyAssignments.courseId,
      dueDate: academyAssignments.dueDate,
      status: academyAssignments.status,
    })
    .from(academyAssignments)
    .where(
      and(
        eq(academyAssignments.workspaceId, workspaceId),
        sql`${academyAssignments.status} <> 'completed'`,
        sql`${academyAssignments.dueDate} is not null and ${academyAssignments.dueDate} <= ${horizon}`,
      ),
    );
  for (const a of aca)
    candidates.push({
      kind: "priority",
      title: `Training due: ${getCourse(a.courseId)?.title ?? a.courseId}`,
      description: `Assigned course due ${a.dueDate}.`,
      referenceType: "academy",
      referenceId: a.id,
    });

  if (candidates.length === 0) return 0;

  // Idempotency: skip any candidate that already has a notification for its
  // source item (one active reminder per item; never re-nag).
  const existing = await adminDb
    .select({
      referenceType: notifications.referenceType,
      referenceId: notifications.referenceId,
    })
    .from(notifications)
    .where(eq(notifications.workspaceId, workspaceId));
  const seen = new Set(
    existing.map((e) => `${e.referenceType}:${e.referenceId}`),
  );

  const toInsert = candidates.filter(
    (c) => !seen.has(`${c.referenceType}:${c.referenceId}`),
  );
  if (toInsert.length === 0) return 0;

  await adminDb.insert(notifications).values(
    toInsert.map((c) => ({
      workspaceId,
      kind: c.kind,
      title: c.title,
      description: c.description,
      referenceType: c.referenceType,
      referenceId: c.referenceId,
    })),
  );
  return toInsert.length;
}

/** Run the reminder engine for every workspace (the cron entry point). */
export async function generateAllReminders(opts?: {
  today?: string;
}): Promise<{ workspaces: number; created: number }> {
  const all = await adminDb.select({ id: workspaces.id }).from(workspaces);
  let created = 0;
  for (const w of all) created += await generateReminders(w.id, opts);
  return { workspaces: all.length, created };
}
