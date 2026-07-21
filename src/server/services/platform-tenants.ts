import { asc, desc, eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import {
  memberships,
  organisations,
  plans,
  platformAuditLog,
  subscriptions,
  workspaces,
} from "../db/schema";
import {
  logPlatformAction,
  type AuditRow,
  type PlatformActor,
} from "./platform-admin";
import { getUserEmails } from "./members";

// Cross-tenant tenant management for the platform admin: one workspace's full
// detail, and audited manual overrides of its subscription/quota (bypassing
// Stripe - for comps, support and enterprise deals). Service-role (adminDb).

export interface TenantMember {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  createdAt: Date;
}

export interface TenantDetail {
  id: string;
  name: string;
  org: string;
  createdAt: Date;
  suspendedAt: Date | null;
  subscription: {
    planKey: string | null;
    planName: string | null;
    status: string | null;
    seatsAllowed: number | null;
    currentPeriodEnd: Date | null;
    hasStripeCustomer: boolean;
    hasStripeSubscription: boolean;
  } | null;
  seatsUsed: number;
  members: TenantMember[];
}

export async function getPlatformWorkspaceDetail(
  workspaceId: string,
): Promise<TenantDetail | null> {
  const row = (
    await adminDb
      .select({
        id: workspaces.id,
        name: workspaces.name,
        createdAt: workspaces.createdAt,
        suspendedAt: workspaces.suspendedAt,
        org: organisations.name,
        planKey: subscriptions.planKey,
        planName: plans.name,
        status: subscriptions.status,
        seatsAllowed: subscriptions.seatsAllowed,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeCustomerId: subscriptions.stripeCustomerId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(workspaces)
      .innerJoin(organisations, eq(organisations.id, workspaces.organisationId))
      .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(plans, eq(plans.key, subscriptions.planKey))
      .where(eq(workspaces.id, workspaceId))
      .limit(1)
  )[0];
  if (!row) return null;

  const memberRows = await adminDb
    .select({
      id: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(asc(memberships.createdAt));

  const emails = await getUserEmails(memberRows.map((m) => m.userId));

  return {
    id: row.id,
    name: row.name,
    org: row.org,
    createdAt: row.createdAt,
    suspendedAt: row.suspendedAt,
    subscription: row.planKey
      ? {
          planKey: row.planKey,
          planName: row.planName,
          status: row.status,
          seatsAllowed: row.seatsAllowed,
          currentPeriodEnd: row.currentPeriodEnd,
          hasStripeCustomer: !!row.stripeCustomerId,
          hasStripeSubscription: !!row.stripeSubscriptionId,
        }
      : null,
    seatsUsed: memberRows.length,
    members: memberRows.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: emails[m.userId] ?? null,
      role: m.role,
      createdAt: m.createdAt,
    })),
  };
}

export interface PlanOption {
  key: string;
  name: string;
  seatLimit: number | null;
}

export async function listPlans(): Promise<PlanOption[]> {
  return adminDb
    .select({ key: plans.key, name: plans.name, seatLimit: plans.seatLimit })
    .from(plans)
    .orderBy(asc(plans.sortOrder));
}

export interface SubscriptionOverride {
  planKey?: string;
  status?: string;
  seatsAllowed?: number;
  trialDays?: number; // extend/set the trial period from now
}

export type OverrideResult = { ok: true } | { ok: false; error: string };

/**
 * Manually override a workspace's subscription/quota (audited). Bypasses Stripe
 * - the canonical row is updated directly, e.g. for comps or enterprise deals.
 */
export async function setSubscriptionOverride(
  actor: PlatformActor,
  workspaceId: string,
  patch: SubscriptionOverride,
): Promise<OverrideResult> {
  if (patch.planKey) {
    const exists = (
      await adminDb
        .select({ key: plans.key })
        .from(plans)
        .where(eq(plans.key, patch.planKey))
        .limit(1)
    )[0];
    if (!exists) return { ok: false, error: "Unknown plan." };
  }
  if (patch.seatsAllowed !== undefined && patch.seatsAllowed < 1)
    return { ok: false, error: "Seats must be at least 1." };

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.planKey) set.planKey = patch.planKey;
  if (patch.status) set.status = patch.status;
  if (patch.seatsAllowed !== undefined) set.seatsAllowed = patch.seatsAllowed;
  if (patch.trialDays !== undefined) {
    set.currentPeriodEnd = new Date(Date.now() + patch.trialDays * 86_400_000);
    if (!patch.status) set.status = "trialing";
  }
  if (Object.keys(set).length === 1)
    return { ok: false, error: "Nothing to change." };

  const updated = await adminDb
    .update(subscriptions)
    .set(set)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .returning({ id: subscriptions.id });

  if (!updated.length) {
    // No subscription row yet - create one from the patch.
    await adminDb.insert(subscriptions).values({
      workspaceId,
      planKey: patch.planKey ?? "starter",
      status: (set.status as string) ?? "trialing",
      seatsAllowed: patch.seatsAllowed ?? 1,
      currentPeriodEnd: (set.currentPeriodEnd as Date) ?? null,
    });
  }

  await logPlatformAction(actor, "subscription.override", {
    targetWorkspaceId: workspaceId,
    detail: { ...patch } as Record<string, unknown>,
  });
  return { ok: true };
}

/** Recent operator actions targeting one workspace. */
export async function listAuditLogForWorkspace(
  workspaceId: string,
  limit = 25,
): Promise<AuditRow[]> {
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
    .where(eq(platformAuditLog.targetWorkspaceId, workspaceId))
    .orderBy(desc(platformAuditLog.createdAt))
    .limit(limit);
}
