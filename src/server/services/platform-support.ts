import { desc, eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { sqlClient } from "../db";
import { notifications, tenantNotes } from "../db/schema";
import { logPlatformAction, type PlatformActor } from "./platform-admin";
import { getUserEmails } from "./members";

// Operator support tooling: internal notes on a tenant, broadcasting an in-app
// notification to a workspace, and a metadata-only tenant export (never the
// customer's business records - the metadata-only principle still holds).

export interface TenantNote {
  id: string;
  authorEmail: string | null;
  body: string;
  createdAt: Date;
}

export async function listTenantNotes(
  workspaceId: string,
  limit = 50,
): Promise<TenantNote[]> {
  return adminDb
    .select({
      id: tenantNotes.id,
      authorEmail: tenantNotes.authorEmail,
      body: tenantNotes.body,
      createdAt: tenantNotes.createdAt,
    })
    .from(tenantNotes)
    .where(eq(tenantNotes.workspaceId, workspaceId))
    .orderBy(desc(tenantNotes.createdAt))
    .limit(limit);
}

export async function addTenantNote(
  actor: PlatformActor,
  workspaceId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Note is empty." };
  await adminDb.insert(tenantNotes).values({
    workspaceId,
    authorEmail: actor.email,
    body: text.slice(0, 4000),
  });
  await logPlatformAction(actor, "note.add", {
    targetWorkspaceId: workspaceId,
  });
  return { ok: true };
}

/** Send an in-app notification to every member of a workspace. */
export async function broadcastNotification(
  actor: PlatformActor,
  workspaceId: string,
  input: { title: string; description?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  await adminDb.insert(notifications).values({
    workspaceId,
    kind: "priority",
    title: title.slice(0, 200),
    description: input.description?.trim()?.slice(0, 1000) || null,
  });
  await logPlatformAction(actor, "notify.broadcast", {
    targetWorkspaceId: workspaceId,
    detail: { title },
  });
  return { ok: true };
}

export interface TenantExport {
  exportedAt: string;
  workspace: {
    id: string;
    name: string;
    org: string;
    createdAt: string | null;
  };
  subscription: {
    planKey: string | null;
    status: string | null;
    seatsAllowed: number | null;
  } | null;
  members: { email: string | null; role: string; joinedAt: string | null }[];
  recordCounts: Record<string, number>;
}

// Per-workspace record counts (metadata only - never the records themselves).
const COUNT_TABLES = [
  "contracts",
  "compliance_obligations",
  "risks",
  "employees",
  "processing_activities",
  "governance_records",
  "due_diligence_items",
  "tender_opportunities",
  "evidence_library_items",
  "activities",
  "conversations",
  "messages",
  "reports",
] as const;

export async function getTenantExport(
  workspaceId: string,
): Promise<TenantExport | null> {
  const wsRows = await sqlClient<
    {
      id: string;
      name: string;
      org: string;
      created_at: string | null;
      plan_key: string | null;
      status: string | null;
      seats_allowed: number | null;
    }[]
  >`
    select w.id::text as id, w.name, o.name as org, w.created_at,
           s.plan_key, s.status, s.seats_allowed
    from workspaces w
    join organisations o on o.id = w.organisation_id
    left join subscriptions s on s.workspace_id = w.id
    where w.id = ${workspaceId}::uuid limit 1`;
  const w = wsRows[0];
  if (!w) return null;

  const memberRows = await sqlClient<
    { user_id: string; role: string; created_at: string | null }[]
  >`
    select user_id::text, role::text as role, created_at
    from memberships where workspace_id = ${workspaceId}::uuid
    order by created_at`;
  const emails = await getUserEmails(memberRows.map((m) => m.user_id));

  const recordCounts: Record<string, number> = {};
  for (const table of COUNT_TABLES) {
    try {
      const r = await sqlClient<{ n: number }[]>`
        select count(*)::int as n from ${sqlClient(table)}
        where workspace_id = ${workspaceId}::uuid`;
      recordCounts[table] = Number(r[0]?.n ?? 0);
    } catch {
      recordCounts[table] = 0;
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    workspace: { id: w.id, name: w.name, org: w.org, createdAt: w.created_at },
    subscription: w.plan_key
      ? {
          planKey: w.plan_key,
          status: w.status,
          seatsAllowed: w.seats_allowed,
        }
      : null,
    members: memberRows.map((m) => ({
      email: emails[m.user_id] ?? null,
      role: m.role,
      joinedAt: m.created_at,
    })),
    recordCounts,
  };
}
