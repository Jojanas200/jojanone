import { desc, sql } from "drizzle-orm";
import { withUser, type UserClaims, type Tx } from "../db";
import { activities } from "../db/schema";

// Activity trail. `recordActivity` is called INSIDE a module's existing
// withUser() transaction, so an event is written iff the domain write commits
// (atomic). `listActivities` reads the trail for the Executive feed (RLS-scoped).

type ActivityTypeValue = (typeof activities.activityType.enumValues)[number];
type ActivityStatusValue = (typeof activities.status.enumValues)[number];
type PriorityValue = (typeof activities.priority.enumValues)[number];

export type ActivityAction =
  "created" | "updated" | "completed" | "deleted" | "status changed";

// Each app module maps to the closest coarse activity_type. The precise module
// is always kept in the `module` column, so display never relies on this.
const MODULE_TYPE: Record<string, ActivityTypeValue> = {
  contracts: "contract",
  compliance: "obligation",
  risk: "risk",
  hr: "review",
  gdpr: "policy",
  governance: "decision",
  "tender-ready": "report",
  "investor-ready": "review",
  academy: "training",
};

const MODULE_LABEL: Record<string, string> = {
  contracts: "Contract",
  compliance: "Obligation",
  risk: "Risk",
  hr: "Employee",
  gdpr: "Processing activity",
  governance: "Governance record",
  "tender-ready": "Tender",
  "investor-ready": "Due-diligence item",
  academy: "Course",
};

export interface RecordActivityInput {
  module: string;
  action: ActivityAction;
  /** Human title of the affected entity (e.g. the contract's title). */
  title: string;
  referenceId?: string | null;
  priority?: PriorityValue;
  /** Optional extra detail; defaults to "<Entity> <action>". */
  description?: string;
}

export function recordActivity(
  tx: Tx,
  workspaceId: string,
  input: RecordActivityInput,
) {
  const label = MODULE_LABEL[input.module] ?? "Record";
  const status: ActivityStatusValue =
    input.action === "completed"
      ? "completed"
      : input.action === "deleted"
        ? "completed"
        : "info";
  return tx.insert(activities).values({
    workspaceId,
    // Stamp the acting user from the RLS JWT claims set by withUser(). NULL for
    // service-role / system writes (no claims). No caller changes needed.
    actorUserId: sql`(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid`,
    activityType: MODULE_TYPE[input.module] ?? "system",
    module: input.module,
    title: input.title,
    description: input.description ?? `${label} ${input.action}`,
    status,
    priority: input.priority ?? "none",
    referenceType: input.module,
    referenceId: input.referenceId ?? null,
    completedAt: input.action === "completed" ? sql`now()` : null,
  });
}

export interface ActivityRow {
  id: string;
  module: string;
  title: string;
  description: string | null;
  action: string;
  createdAt: Date;
}

export function listActivities(
  claims: UserClaims,
  limit = 20,
): Promise<ActivityRow[]> {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({
        id: activities.id,
        module: activities.module,
        title: activities.title,
        description: activities.description,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
    return rows.map((r) => ({ ...r, action: r.description ?? "" }));
  });
}
