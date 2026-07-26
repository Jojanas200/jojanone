import { and, desc, eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { memberships, workspaces } from "../db/schema";

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
