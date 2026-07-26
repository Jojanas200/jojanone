import { asc, eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { recordActivity } from "./activity";
import { businessProfiles, memberships, workspaces } from "../db/schema";
import type {
  UpdateBusinessProfileInput,
  UpdateWorkspaceInput,
} from "../../shared/schemas/settings";

/** Settings - business profile, workspace preferences, members. RLS-scoped. */

// Fields that count toward the profile-completion percentage.
const COMPLETION_FIELDS = [
  "businessName",
  "companyNumber",
  "businessType",
  "industry",
  "incorporationDate",
  "registeredAddress",
  "financialYearEnd",
  "annualRevenueBand",
] as const;

type ProfileRow = typeof businessProfiles.$inferSelect;

function computeCompletion(p: ProfileRow): number {
  const filled = COMPLETION_FIELDS.filter((k) => {
    const v = p[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

export function getBusinessProfile(claims: UserClaims, workspaceId: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.workspaceId, workspaceId))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function updateBusinessProfile(
  claims: UserClaims,
  workspaceId: string,
  input: UpdateBusinessProfileInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(businessProfiles)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(businessProfiles.workspaceId, workspaceId))
      .returning();
    const updated = rows[0];
    if (!updated) return null;
    await recordActivity(tx, workspaceId, {
      module: "settings",
      action: "updated",
      title: "Business profile updated",
    });
    // Recompute completion from the persisted row and store it.
    const completion = computeCompletion(updated);
    if (completion !== updated.profileCompletion) {
      const rescored = await tx
        .update(businessProfiles)
        .set({ profileCompletion: completion })
        .where(eq(businessProfiles.workspaceId, workspaceId))
        .returning();
      return rescored[0] ?? updated;
    }
    return updated;
  });
}

export function getWorkspace(claims: UserClaims, workspaceId: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function updateWorkspace(
  claims: UserClaims,
  workspaceId: string,
  input: UpdateWorkspaceInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(workspaces)
      .set(input)
      .where(eq(workspaces.id, workspaceId))
      .returning();
    return rows[0] ?? null;
  });
}

export function listMembers(claims: UserClaims, workspaceId: string) {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: memberships.id,
        userId: memberships.userId,
        role: memberships.role,
        scopedModules: memberships.scopedModules,
        expiresAt: memberships.expiresAt,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(asc(memberships.createdAt)),
  );
}
