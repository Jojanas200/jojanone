import { and, desc, eq, isNull } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { adminDb } from "../db/admin";
import { memberships, plans, subscriptions, workspaces } from "../db/schema";

/**
 * The optional modules the workspace's package unlocks, or null when it is on
 * no package at all. null means unrestricted: imported and legacy workspaces
 * keep full access rather than being silently locked out.
 *
 * A lapsed trial returns [] rather than the package's own features. That
 * withdraws the optional modules while leaving every core module in place, so
 * the customer keeps their records and their Business Confidence Score and is
 * asked to subscribe rather than locked out of their own data.
 *
 * Reads the catalogue with the service role - the plans table is a global
 * catalogue, not tenant data, and the workspace id is resolved from the
 * caller's own session before this is called.
 */
export async function planFeaturesFor(
  workspaceId: string,
): Promise<string[] | null> {
  const rows = await adminDb
    .select({
      features: plans.features,
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.key, subscriptions.planKey))
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return trialHasLapsed(row.status, row.trialEndsAt) ? [] : row.features;
}

/**
 * True when a subscription is still only a trial and its end has passed. Any
 * other status - active, past_due, cancelled - is the billing system's to
 * judge, not ours.
 */
export function trialHasLapsed(
  status: string,
  trialEndsAt: Date | null,
  now: Date = new Date(),
): boolean {
  return status === "trialing" && trialEndsAt !== null && trialEndsAt <= now;
}

/**
 * Record the package the customer intends to buy. Only a published, sellable
 * package is accepted, and it changes entitlement for nobody - it decides
 * which package the billing screen and checkout preselect.
 *
 * Returns whether the intent was stored, so a caller can tell "ignored" from
 * "saved" rather than assuming.
 */
export async function setIntendedPlan(
  workspaceId: string,
  planKey: string | null,
): Promise<boolean> {
  if (!planKey) {
    await adminDb
      .update(subscriptions)
      .set({ intendedPlanKey: null, updatedAt: new Date() })
      .where(eq(subscriptions.workspaceId, workspaceId));
    return true;
  }

  const rows = await adminDb
    .select({ key: plans.key })
    .from(plans)
    .where(
      and(
        eq(plans.key, planKey),
        eq(plans.published, true),
        eq(plans.isSellable, true),
        isNull(plans.archivedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) return false;

  await adminDb
    .update(subscriptions)
    .set({ intendedPlanKey: rows[0].key, updatedAt: new Date() })
    .where(eq(subscriptions.workspaceId, workspaceId));
  return true;
}

/** The package new signups trial, as designated by the operator. */
export async function trialPlan(): Promise<{
  key: string;
  name: string;
  trialDays: number;
} | null> {
  const rows = await adminDb
    .select({
      key: plans.key,
      name: plans.name,
      trialDays: plans.trialDays,
    })
    .from(plans)
    .where(and(eq(plans.isTrialDefault, true), isNull(plans.archivedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/** What a workspace's trial looks like today, for the billing screen. */
export interface TrialState {
  isTrial: boolean;
  endsAt: Date | null;
  daysLeft: number | null;
  lapsed: boolean;
  intendedPlanKey: string | null;
}

export async function trialStateFor(workspaceId: string): Promise<TrialState> {
  const rows = await adminDb
    .select({
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
      intendedPlanKey: subscriptions.intendedPlanKey,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      isTrial: false,
      endsAt: null,
      daysLeft: null,
      lapsed: false,
      intendedPlanKey: null,
    };
  }

  const isTrial = row.status === "trialing";
  const endsAt = row.trialEndsAt;
  const lapsed = trialHasLapsed(row.status, endsAt);
  return {
    isTrial,
    endsAt,
    // Rounded up, so the last partial day still reads as "1 day left".
    daysLeft:
      isTrial && endsAt
        ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000))
        : null,
    lapsed,
    intendedPlanKey: row.intendedPlanKey,
  };
}

/** Workspaces the current user belongs to (RLS-scoped), with their role. */
export function listMyWorkspaces(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: memberships.role,
        suspendedAt: workspaces.suspendedAt,
        brandColor: workspaces.brandColor,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .orderBy(desc(workspaces.createdAt)),
  );
}

/** The user's current active workspace id (first membership), or null if none. */
export async function getActiveWorkspaceId(
  claims: UserClaims,
): Promise<string | null> {
  const rows = await listMyWorkspaces(claims);
  return rows[0]?.id ?? null;
}

/** The caller's role in a workspace, or null if they aren't a member. */
export function getWorkspaceRole(
  claims: UserClaims,
  workspaceId: string,
): Promise<string | null> {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, claims.sub),
        ),
      )
      .limit(1);
    return rows[0]?.role ?? null;
  });
}

// Roles allowed to MUTATE tenant data. Mirrors the DB can_write_workspace()
// helper (advisers and read_only are excluded), so the UI can hide write
// affordances that RLS would reject anyway.
export const CAN_WRITE_ROLES = ["owner_admin", "manager", "team_member"];

export interface WorkspaceAccess {
  role: string | null;
  canWrite: boolean;
  /** null = all modules; otherwise the adviser's allow-list of module keys. */
  scopedModules: string[] | null;
}

/** The caller's full access profile in a workspace (role + write + scope). */
export function getWorkspaceAccess(
  claims: UserClaims,
  workspaceId: string,
): Promise<WorkspaceAccess> {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({ role: memberships.role, scoped: memberships.scopedModules })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, claims.sub),
        ),
      )
      .limit(1);
    const role = rows[0]?.role ?? null;
    return {
      role,
      canWrite: role ? CAN_WRITE_ROLES.includes(role) : false,
      scopedModules: rows[0]?.scoped ?? null,
    };
  });
}

/** True if a module key is within an adviser's scope (null scope = all). */
export function isModuleAllowed(
  scopedModules: string[] | null,
  moduleKey: string,
): boolean {
  return !scopedModules || scopedModules.includes(moduleKey);
}
