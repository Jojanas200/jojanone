import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { hrActions } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateHrActionInput,
  UpdateHrActionInput,
} from "../../shared/schemas/hr-actions";

// People tasks (right-to-work checks, probation reviews, training, welfare…),
// optionally linked to an employee. RLS-scoped via withUser().

export function listHrActions(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(hrActions)
      .orderBy(
        sql`${hrActions.dueDate} asc nulls last`,
        desc(hrActions.createdAt),
      ),
  );
}

export function createHrAction(
  claims: UserClaims,
  workspaceId: string,
  input: CreateHrActionInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(hrActions)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
        completedAt: input.status === "completed" ? sql`now()` : null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "hr",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
      priority: rows[0].priority === "none" ? undefined : rows[0].priority,
    });
    return rows[0];
  });
}

export function updateHrAction(
  claims: UserClaims,
  id: string,
  input: UpdateHrActionInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(hrActions)
      .set({
        ...input,
        updatedBy: claims.sub,
        ...(input.status
          ? { completedAt: input.status === "completed" ? sql`now()` : null }
          : {}),
      })
      .where(eq(hrActions.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "hr",
        action: input.status === "completed" ? "completed" : "updated",
        title: row.title,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function deleteHrAction(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(hrActions)
      .where(eq(hrActions.id, id))
      .returning({ id: hrActions.id });
    return rows.length > 0;
  });
}
