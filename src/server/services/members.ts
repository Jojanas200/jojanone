import { and, eq, sql } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { sqlClient, withUser, type UserClaims } from "../db";
import { memberships } from "../db/schema";
import { filterKnownModules } from "@/config/modules.config";

// Member management (owner_admin only). Role changes and removals run through
// withUser() so RLS enforces owner-only writes. Ownership TRANSFER is the one
// operation that demotes the caller - RLS's WITH CHECK would reject an owner
// editing themselves out of the owner role, so transfer runs with the service
// role behind an explicit owner check (mirrors acceptInvitation).

export const APP_ROLES = [
  "owner_admin",
  "manager",
  "team_member",
  "adviser",
  "read_only",
] as const;
export type AppRoleName = (typeof APP_ROLES)[number];

// Roles an owner can step down to when handing over ownership.
export const STEP_DOWN_ROLES = ["manager", "team_member", "read_only"] as const;
export type StepDownRole = (typeof STEP_DOWN_ROLES)[number];

export type MemberResult = { ok: true } | { ok: false; error: string };

/** Resolve auth emails for a set of member user ids (service role). */
export async function getUserEmails(
  userIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return {};
  // postgres-js binds a JS array as a real Postgres array (unlike drizzle's sql
  // template, which would expand it into a tuple). Service-role connection.
  const rows = await sqlClient<{ id: string; email: string | null }[]>`
    select id::text as id, email
    from auth.users
    where id::text = any(${ids})`;
  const map: Record<string, string> = {};
  for (const r of rows) if (r.email) map[r.id] = r.email;
  return map;
}

/**
 * Change a member's role (owner_admin only, via RLS). Promoting to owner_admin
 * creates a co-owner. Refuses to touch your own row (use transferOwnership) and
 * refuses to demote the last owner.
 */
export async function updateMemberRole(
  claims: UserClaims,
  workspaceId: string,
  membershipId: string,
  newRole: AppRoleName,
): Promise<MemberResult> {
  if (!APP_ROLES.includes(newRole))
    return { ok: false, error: "Invalid role." };

  return withUser(claims, async (tx) => {
    const target = (
      await tx
        .select({
          userId: memberships.userId,
          role: memberships.role,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.workspaceId, workspaceId),
          ),
        )
        .limit(1)
    )[0];
    if (!target) return { ok: false, error: "Member not found." };
    if (target.userId === claims.sub)
      return {
        ok: false,
        error:
          "You cannot change your own role. Use Transfer ownership to hand over.",
      };
    if (target.role === newRole) return { ok: true };

    // Never leave a workspace without an owner.
    if (target.role === "owner_admin" && newRole !== "owner_admin") {
      const owners = await countOwners(tx, workspaceId);
      if (owners <= 1)
        return {
          ok: false,
          error: "A workspace must keep at least one owner.",
        };
    }

    const updated = await tx
      .update(memberships)
      .set({
        role: newRole,
        // Scope is only meaningful for advisers; clear it otherwise.
        ...(newRole === "adviser" ? {} : { scopedModules: null }),
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, membershipId))
      .returning({ id: memberships.id });
    // RLS silently updates 0 rows for a non-owner; treat that as a denial.
    if (!updated.length)
      return {
        ok: false,
        error: "You do not have permission to change this member.",
      };
    return { ok: true };
  });
}

/**
 * Re-scope an existing adviser's module allow-list (owner_admin only, via RLS).
 * Empty/unknown selection = full access (null). Only advisers carry a scope.
 */
export async function updateMemberScope(
  claims: UserClaims,
  workspaceId: string,
  membershipId: string,
  scopedModules: string[] | null,
): Promise<MemberResult> {
  const scope = filterKnownModules(scopedModules);
  return withUser(claims, async (tx) => {
    const target = (
      await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.workspaceId, workspaceId),
          ),
        )
        .limit(1)
    )[0];
    if (!target) return { ok: false, error: "Member not found." };
    if (target.role !== "adviser")
      return {
        ok: false,
        error: "Module scope only applies to advisers.",
      };

    const updated = await tx
      .update(memberships)
      .set({ scopedModules: scope, updatedAt: new Date() })
      .where(eq(memberships.id, membershipId))
      .returning({ id: memberships.id });
    if (!updated.length)
      return {
        ok: false,
        error: "You do not have permission to change this member.",
      };
    return { ok: true };
  });
}

/** Remove a member (owner_admin only, via RLS). Frees a seat. */
export async function removeMember(
  claims: UserClaims,
  workspaceId: string,
  membershipId: string,
): Promise<MemberResult> {
  return withUser(claims, async (tx) => {
    const target = (
      await tx
        .select({
          userId: memberships.userId,
          role: memberships.role,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.workspaceId, workspaceId),
          ),
        )
        .limit(1)
    )[0];
    if (!target) return { ok: false, error: "Member not found." };
    if (target.userId === claims.sub)
      return {
        ok: false,
        error:
          "You cannot remove yourself. Transfer ownership first, or ask another owner.",
      };
    if (target.role === "owner_admin") {
      const owners = await countOwners(tx, workspaceId);
      if (owners <= 1)
        return {
          ok: false,
          error: "A workspace must keep at least one owner.",
        };
    }
    const deleted = await tx
      .delete(memberships)
      .where(eq(memberships.id, membershipId))
      .returning({ id: memberships.id });
    if (!deleted.length)
      return {
        ok: false,
        error: "You do not have permission to remove this member.",
      };
    return { ok: true };
  });
}

/**
 * Transfer ownership: promote the target to owner_admin and step the caller
 * down to `stepDownRole`. Runs with the service role because RLS would block an
 * owner from demoting their own membership. Guarded by an explicit owner check.
 */
export async function transferOwnership(
  claims: UserClaims,
  workspaceId: string,
  targetMembershipId: string,
  stepDownRole: StepDownRole = "manager",
): Promise<MemberResult> {
  if (!STEP_DOWN_ROLES.includes(stepDownRole))
    return { ok: false, error: "Invalid role to step down to." };

  const callerRole = (
    await adminDb
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, claims.sub),
        ),
      )
      .limit(1)
  )[0]?.role;
  if (callerRole !== "owner_admin")
    return { ok: false, error: "Only an owner can transfer ownership." };

  const target = (
    await adminDb
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, targetMembershipId),
          eq(memberships.workspaceId, workspaceId),
        ),
      )
      .limit(1)
  )[0];
  if (!target) return { ok: false, error: "Member not found." };
  if (target.userId === claims.sub)
    return { ok: false, error: "Choose a different member to transfer to." };

  await adminDb.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ role: "owner_admin", scopedModules: null, updatedAt: new Date() })
      .where(eq(memberships.id, targetMembershipId));
    await tx
      .update(memberships)
      .set({ role: stepDownRole, updatedAt: new Date() })
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, claims.sub),
        ),
      );
  });
  return { ok: true };
}

async function countOwners(
  tx: Parameters<Parameters<typeof withUser>[1]>[0],
  workspaceId: string,
): Promise<number> {
  const row = (
    await tx
      .select({ n: sql<number>`count(*)` })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.role, "owner_admin"),
        ),
      )
  )[0];
  return Number(row?.n ?? 0);
}
