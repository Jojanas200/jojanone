import { desc, eq, inArray } from "drizzle-orm";
import { adminDb } from "../db/admin";
import {
  activities,
  organisations,
  platformAuditLog,
  workspaces,
} from "../db/schema";
import { getUserEmails } from "./members";

// Cross-tenant logs for the platform admin:
//  - OPERATOR actions (platform_audit_log): who did what across tenants;
//  - TENANT activity (activities): the in-app activity feed across all tenants.
// Read-only, service-role (adminDb).

export interface OperatorAuditRow {
  id: string;
  actorEmail: string;
  action: string;
  targetWorkspaceId: string | null;
  targetWorkspaceName: string | null;
  targetUserId: string | null;
  detail: unknown;
  createdAt: Date;
}

export async function listOperatorAudit(opts?: {
  action?: string;
  limit?: number;
}): Promise<OperatorAuditRow[]> {
  const limit = opts?.limit ?? 100;
  const rows = await adminDb
    .select({
      id: platformAuditLog.id,
      actorEmail: platformAuditLog.actorEmail,
      action: platformAuditLog.action,
      targetWorkspaceId: platformAuditLog.targetWorkspaceId,
      targetUserId: platformAuditLog.targetUserId,
      detail: platformAuditLog.detail,
      createdAt: platformAuditLog.createdAt,
    })
    .from(platformAuditLog)
    .where(opts?.action ? eq(platformAuditLog.action, opts.action) : undefined)
    .orderBy(desc(platformAuditLog.createdAt))
    .limit(limit);

  // Resolve workspace names for the referenced tenants.
  const wsIds = [
    ...new Set(rows.map((r) => r.targetWorkspaceId).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (wsIds.length) {
    const nameRows = await adminDb
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(inArray(workspaces.id, wsIds));
    for (const n of nameRows) names.set(n.id, n.name);
  }

  return rows.map((r) => ({
    ...r,
    targetWorkspaceName: r.targetWorkspaceId
      ? (names.get(r.targetWorkspaceId) ?? null)
      : null,
  }));
}

/** Distinct operator-action names, for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await adminDb
    .selectDistinct({ action: platformAuditLog.action })
    .from(platformAuditLog)
    .orderBy(platformAuditLog.action);
  return rows.map((r) => r.action);
}

export interface TenantActivityRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  org: string;
  module: string;
  activityType: string;
  title: string;
  status: string;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: Date;
}

export async function listTenantActivity(opts?: {
  module?: string;
  limit?: number;
}): Promise<TenantActivityRow[]> {
  const limit = opts?.limit ?? 100;
  const rows = await adminDb
    .select({
      id: activities.id,
      workspaceId: activities.workspaceId,
      workspaceName: workspaces.name,
      org: organisations.name,
      module: activities.module,
      activityType: activities.activityType,
      title: activities.title,
      status: activities.status,
      actorUserId: activities.actorUserId,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .innerJoin(workspaces, eq(workspaces.id, activities.workspaceId))
    .innerJoin(organisations, eq(organisations.id, workspaces.organisationId))
    .where(opts?.module ? eq(activities.module, opts.module) : undefined)
    .orderBy(desc(activities.createdAt))
    .limit(limit);

  // Resolve actor emails (the acting user for each activity, when stamped).
  const emails = await getUserEmails(
    rows.map((r) => r.actorUserId).filter((x): x is string => !!x),
  );
  return rows.map((r) => ({
    ...r,
    actorEmail: r.actorUserId ? (emails[r.actorUserId] ?? null) : null,
  }));
}

/** Distinct modules that have activity, for the filter dropdown. */
export async function listActivityModules(): Promise<string[]> {
  const rows = await adminDb
    .selectDistinct({ module: activities.module })
    .from(activities)
    .orderBy(activities.module);
  return rows.map((r) => r.module);
}
