import { asc, eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { dueDiligenceItems } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateDueDiligenceItemInput,
  UpdateDueDiligenceItemInput,
} from "../../shared/schemas/investor";

/** Investor Ready - due-diligence items. All queries run through withUser() (RLS). */

export function listDueDiligenceItems(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(dueDiligenceItems)
      .orderBy(asc(dueDiligenceItems.category), asc(dueDiligenceItems.title)),
  );
}

export function getDueDiligenceItem(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(dueDiligenceItems)
      .where(eq(dueDiligenceItems.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createDueDiligenceItem(
  claims: UserClaims,
  workspaceId: string,
  input: CreateDueDiligenceItemInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(dueDiligenceItems)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "investor-ready",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
      priority: rows[0].priority,
    });
    return rows[0];
  });
}

export function updateDueDiligenceItem(
  claims: UserClaims,
  id: string,
  input: UpdateDueDiligenceItemInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(dueDiligenceItems)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(dueDiligenceItems.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteDueDiligenceItem(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(dueDiligenceItems)
      .where(eq(dueDiligenceItems.id, id))
      .returning({
        id: dueDiligenceItems.id,
        title: dueDiligenceItems.title,
        workspaceId: dueDiligenceItems.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "investor-ready",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}
