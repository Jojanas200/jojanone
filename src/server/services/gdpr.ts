import { asc, eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { processingActivities } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateProcessingActivityInput,
  UpdateProcessingActivityInput,
} from "../../shared/schemas/gdpr";

/**
 * GDPR - record of processing activities (ROPA). All queries run through
 * withUser() (RLS). This table has no soft-delete column, so "remove" is a hard
 * delete; day-to-day removal is done by archiving (status = 'archived').
 */

export function listProcessingActivities(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(processingActivities)
      .orderBy(asc(processingActivities.activityName)),
  );
}

export function getProcessingActivity(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(processingActivities)
      .where(eq(processingActivities.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createProcessingActivity(
  claims: UserClaims,
  workspaceId: string,
  input: CreateProcessingActivityInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(processingActivities)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "gdpr",
      action: "created",
      title: rows[0].activityName,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateProcessingActivity(
  claims: UserClaims,
  id: string,
  input: UpdateProcessingActivityInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(processingActivities)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(processingActivities.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteProcessingActivity(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(processingActivities)
      .where(eq(processingActivities.id, id))
      .returning({
        id: processingActivities.id,
        title: processingActivities.activityName,
        workspaceId: processingActivities.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "gdpr",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}
