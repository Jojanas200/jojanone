import { and, eq, isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { complianceObligations } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateObligationInput,
  UpdateObligationInput,
} from "../../shared/schemas/compliance";

/** Compliance obligations service. All queries run through withUser() (RLS). */

export function listObligations(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(complianceObligations)
      .where(isNull(complianceObligations.deletedAt))
      // soonest due first, undated last
      .orderBy(sql`${complianceObligations.dueDate} asc nulls last`),
  );
}

export function getObligation(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(complianceObligations)
      .where(
        and(
          eq(complianceObligations.id, id),
          isNull(complianceObligations.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createObligation(
  claims: UserClaims,
  workspaceId: string,
  input: CreateObligationInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(complianceObligations)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "compliance",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
      priority: rows[0].priority,
    });
    return rows[0];
  });
}

export function updateObligation(
  claims: UserClaims,
  id: string,
  input: UpdateObligationInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(complianceObligations)
      .set({ ...input, updatedBy: claims.sub })
      .where(
        and(
          eq(complianceObligations.id, id),
          isNull(complianceObligations.deletedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  });
}

/** Advance the lifecycle; stamps completed_at when moving to 'completed'. */
export function setObligationStatus(
  claims: UserClaims,
  id: string,
  status: string,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(complianceObligations)
      .set({
        status: status as never,
        updatedBy: claims.sub,
        completedAt: status === "completed" ? sql`now()` : null,
      })
      .where(
        and(
          eq(complianceObligations.id, id),
          isNull(complianceObligations.deletedAt),
        ),
      )
      .returning();
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "compliance",
        action: status === "completed" ? "completed" : "status changed",
        title: rows[0].title,
        referenceId: rows[0].id,
        description: `Obligation marked ${status.replace(/_/g, " ")}`,
      });
    }
    return rows[0] ?? null;
  });
}

export function deleteObligation(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(complianceObligations)
      .set({ deletedAt: sql`now()`, updatedBy: claims.sub })
      .where(
        and(
          eq(complianceObligations.id, id),
          isNull(complianceObligations.deletedAt),
        ),
      )
      .returning({
        id: complianceObligations.id,
        title: complianceObligations.title,
        workspaceId: complianceObligations.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "compliance",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}
