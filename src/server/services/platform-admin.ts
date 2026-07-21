import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { adminDb } from "../db/admin";
import { sqlClient } from "../db";
import { getSessionUser } from "../auth/session";
import {
  memberships,
  organisations,
  platformAuditLog,
  plans,
  subscriptions,
  workspaces,
} from "../db/schema";

export interface PlatformActor {
  sub: string;
  email: string | null;
}

// Platform administration ("Jojan One management"). This is the ONLY part of
// the app that reads across tenants, so it is fenced off deliberately:
//
//  - Authority is an env allowlist (PLATFORM_ADMIN_EMAILS), NOT a DB role —
//    a tenant-side privilege escalation cannot make anyone a platform admin.
//  - Cross-tenant reads use adminDb (RLS-bypassed) and are only ever reached
//    through requirePlatformAdmin() in the /admin surface.
//  - Operators see account/subscription/usage METADATA only — never the
//    customers' business records (contracts, HR, GDPR, evidence, etc.).

function parseEmails(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function platformAdminEmails(): string[] {
  return parseEmails(process.env.PLATFORM_ADMIN_EMAILS);
}
export function platformAnalystEmails(): string[] {
  return parseEmails(process.env.PLATFORM_ANALYST_EMAILS);
}

// Two tiers: OPERATORS (PLATFORM_ADMIN_EMAILS) can perform every action;
// ANALYSTS (PLATFORM_ANALYST_EMAILS) get read-only access to the /admin surface.
// Operator wins if an email is (mistakenly) in both lists.
export type PlatformRole = "operator" | "analyst";

export function getPlatformRole(
  email: string | null | undefined,
): PlatformRole | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (platformAdminEmails().includes(e)) return "operator";
  if (platformAnalystEmails().includes(e)) return "analyst";
  return null;
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return getPlatformRole(email) !== null;
}

export function isPlatformOperator(email: string | null | undefined): boolean {
  return getPlatformRole(email) === "operator";
}

export interface PlatformSession {
  sub: string;
  email: string | null;
  role: PlatformRole;
}

/**
 * Gate a platform page/route. Redirects to /login if signed out; returns 404
 * (hides the surface's existence) if signed in but not a platform admin.
 * Returns the caller's tier so write actions can be operator-gated.
 */
export async function requirePlatformAdmin(): Promise<PlatformSession> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const role = getPlatformRole(user.email);
  if (!role) notFound();
  return { sub: user.sub, email: user.email, role };
}

export interface PlatformWorkspace {
  id: string;
  name: string;
  org: string;
  planKey: string | null;
  planName: string | null;
  status: string | null;
  priceMinor: number | null;
  seatsAllowed: number | null;
  seatsUsed: number;
  currentPeriodEnd: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
}

/** Every workspace across all tenants (metadata only), newest first. */
export async function listPlatformWorkspaces(): Promise<PlatformWorkspace[]> {
  const rows = await adminDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
      org: organisations.name,
      planKey: subscriptions.planKey,
      planName: plans.name,
      status: subscriptions.status,
      priceMinor: plans.priceMinor,
      seatsAllowed: subscriptions.seatsAllowed,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      suspendedAt: workspaces.suspendedAt,
    })
    .from(workspaces)
    .innerJoin(organisations, eq(organisations.id, workspaces.organisationId))
    .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
    .leftJoin(plans, eq(plans.key, subscriptions.planKey))
    .orderBy(desc(workspaces.createdAt));

  const counts = await adminDb
    .select({
      workspaceId: memberships.workspaceId,
      n: sql<number>`count(*)`,
    })
    .from(memberships)
    .groupBy(memberships.workspaceId);
  const usedByWs = new Map(counts.map((c) => [c.workspaceId, Number(c.n)]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    org: r.org,
    planKey: r.planKey,
    planName: r.planName,
    status: r.status,
    priceMinor: r.priceMinor,
    seatsAllowed: r.seatsAllowed,
    seatsUsed: usedByWs.get(r.id) ?? 0,
    currentPeriodEnd: r.currentPeriodEnd,
    suspendedAt: r.suspendedAt,
    createdAt: r.createdAt,
  }));
}

// --- Privileged actions (audited) --------------------------------------------

export async function logPlatformAction(
  actor: PlatformActor,
  action: string,
  opts?: {
    targetWorkspaceId?: string | null;
    targetUserId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  await adminDb.insert(platformAuditLog).values({
    actorId: actor.sub,
    actorEmail: actor.email ?? "unknown",
    action,
    targetWorkspaceId: opts?.targetWorkspaceId ?? null,
    targetUserId: opts?.targetUserId ?? null,
    detail: opts?.detail ?? {},
  });
}

/** Suspend a workspace (blocks the tenant from the app). Audited. */
export async function suspendWorkspace(
  actor: PlatformActor,
  workspaceId: string,
  reason?: string,
) {
  await adminDb
    .update(workspaces)
    .set({ suspendedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  await logPlatformAction(actor, "workspace.suspend", {
    targetWorkspaceId: workspaceId,
    detail: reason ? { reason } : {},
  });
}

/** Lift a suspension. Audited. */
export async function unsuspendWorkspace(
  actor: PlatformActor,
  workspaceId: string,
) {
  await adminDb
    .update(workspaces)
    .set({ suspendedAt: null })
    .where(eq(workspaces.id, workspaceId));
  await logPlatformAction(actor, "workspace.unsuspend", {
    targetWorkspaceId: workspaceId,
  });
}

/** The owner_admin user of a workspace (impersonation target). */
export async function getWorkspaceOwner(
  workspaceId: string,
): Promise<{ userId: string } | null> {
  const rows = await adminDb
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.role, "owner_admin"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface AuditRow {
  id: string;
  actorEmail: string;
  action: string;
  targetWorkspaceId: string | null;
  targetUserId: string | null;
  detail: unknown;
  createdAt: Date;
}

export async function listAuditLog(limit = 50): Promise<AuditRow[]> {
  return adminDb
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
    .orderBy(desc(platformAuditLog.createdAt))
    .limit(limit);
}

export interface PlatformOverview {
  workspaces: number;
  organisations: number;
  members: number;
  byPlan: Record<string, number>;
  byStatus: Record<string, number>;
  activeMrrMinor: number; // sum of plan price for active subscriptions
}

// Headline stats computed as aggregates (does not load every workspace row).
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const num = (v: unknown) => Number(v ?? 0);
  const [scalars, planRows, statusRows] = await Promise.all([
    sqlClient<{ ws: number; orgs: number; members: number; mrr: string }[]>`
      select
        (select count(*) from workspaces)::int as ws,
        (select count(*) from organisations)::int as orgs,
        (select count(*) from memberships)::int as members,
        (select coalesce(sum(p.price_minor), 0)::bigint
           from subscriptions s join plans p on p.key = s.plan_key
           where s.status = 'active') as mrr`,
    sqlClient<{ k: string; n: number }[]>`
      select coalesce(plan_key, 'none') as k, count(*)::int as n
      from subscriptions group by 1`,
    sqlClient<{ k: string; n: number }[]>`
      select coalesce(status, 'none') as k, count(*)::int as n
      from subscriptions group by 1`,
  ]);
  const s = scalars[0];
  const byPlan: Record<string, number> = {};
  for (const r of planRows) byPlan[r.k] = num(r.n);
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.k] = num(r.n);

  return {
    workspaces: num(s?.ws),
    organisations: num(s?.orgs),
    members: num(s?.members),
    byPlan,
    byStatus,
    activeMrrMinor: num(s?.mrr),
  };
}

// --- Paginated / filtered tenant list ----------------------------------------
export type WorkspaceSort = "newest" | "oldest" | "name";

export interface WorkspaceQuery {
  search?: string;
  status?: string;
  plan?: string;
  suspended?: "yes" | "no";
  sort?: WorkspaceSort;
  limit?: number;
  offset?: number;
}

export interface WorkspacePage {
  rows: PlatformWorkspace[];
  total: number;
}

export async function queryPlatformWorkspaces(
  q: WorkspaceQuery,
): Promise<WorkspacePage> {
  const limit = Math.min(Math.max(q.limit ?? 25, 1), 100);
  const offset = Math.max(q.offset ?? 0, 0);

  const conditions = [];
  if (q.search?.trim()) {
    const term = `%${q.search.trim()}%`;
    conditions.push(
      or(ilike(workspaces.name, term), ilike(organisations.name, term)),
    );
  }
  if (q.status) conditions.push(eq(subscriptions.status, q.status));
  if (q.plan) conditions.push(eq(subscriptions.planKey, q.plan));
  if (q.suspended === "yes") conditions.push(isNotNull(workspaces.suspendedAt));
  if (q.suspended === "no") conditions.push(isNull(workspaces.suspendedAt));
  const where = conditions.length ? and(...conditions) : undefined;

  const order =
    q.sort === "oldest"
      ? asc(workspaces.createdAt)
      : q.sort === "name"
        ? asc(workspaces.name)
        : desc(workspaces.createdAt);

  const [rows, totalRow] = await Promise.all([
    adminDb
      .select({
        id: workspaces.id,
        name: workspaces.name,
        createdAt: workspaces.createdAt,
        org: organisations.name,
        planKey: subscriptions.planKey,
        planName: plans.name,
        status: subscriptions.status,
        priceMinor: plans.priceMinor,
        seatsAllowed: subscriptions.seatsAllowed,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        suspendedAt: workspaces.suspendedAt,
      })
      .from(workspaces)
      .innerJoin(organisations, eq(organisations.id, workspaces.organisationId))
      .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(plans, eq(plans.key, subscriptions.planKey))
      .where(where)
      .orderBy(order)
      .limit(limit)
      .offset(offset),
    adminDb
      .select({ n: count() })
      .from(workspaces)
      .innerJoin(organisations, eq(organisations.id, workspaces.organisationId))
      .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
      .where(where),
  ]);

  // Seat usage for the page rows only.
  const ids = rows.map((r) => r.id);
  const usedByWs = new Map<string, number>();
  if (ids.length) {
    const counts = await adminDb
      .select({ workspaceId: memberships.workspaceId, n: count() })
      .from(memberships)
      .where(inArray(memberships.workspaceId, ids))
      .groupBy(memberships.workspaceId);
    for (const c of counts) usedByWs.set(c.workspaceId, Number(c.n));
  }

  return {
    total: Number(totalRow[0]?.n ?? 0),
    rows: rows.map((r) => ({
      ...r,
      seatsUsed: usedByWs.get(r.id) ?? 0,
    })),
  };
}
