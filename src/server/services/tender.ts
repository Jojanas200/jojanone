import { eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { tenderOpportunities } from "../db/schema";
import { recordActivity } from "./activity";
import { randomUUID } from "node:crypto";
import type {
  AddChecklistItemInput,
  CreateTenderOpportunityInput,
  TenderChecklistItem,
  UpdateTenderOpportunityInput,
} from "../../shared/schemas/tender";

/** Tender Ready - opportunities. All queries run through withUser() (RLS). */

export function listTenderOpportunities(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(tenderOpportunities)
      .orderBy(sql`${tenderOpportunities.submissionDeadline} asc nulls last`),
  );
}

export function getTenderOpportunity(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(tenderOpportunities)
      .where(eq(tenderOpportunities.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createTenderOpportunity(
  claims: UserClaims,
  workspaceId: string,
  input: CreateTenderOpportunityInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(tenderOpportunities)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "tender-ready",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateTenderOpportunity(
  claims: UserClaims,
  id: string,
  input: UpdateTenderOpportunityInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(tenderOpportunities)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(tenderOpportunities.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteTenderOpportunity(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(tenderOpportunities)
      .where(eq(tenderOpportunities.id, id))
      .returning({
        id: tenderOpportunities.id,
        title: tenderOpportunities.title,
        workspaceId: tenderOpportunities.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "tender-ready",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}

// --- Submission checklist (embedded jsonb on the opportunity) ----------------

export function addTenderChecklistItem(
  claims: UserClaims,
  id: string,
  input: AddChecklistItemInput,
) {
  return withUser(claims, async (tx) => {
    const current = (
      await tx
        .select({ checklist: tenderOpportunities.checklist })
        .from(tenderOpportunities)
        .where(eq(tenderOpportunities.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    const next: TenderChecklistItem[] = [
      ...current.checklist,
      {
        id: randomUUID(),
        label: input.label,
        mandatory: input.mandatory,
        done: false,
      },
    ];
    const rows = await tx
      .update(tenderOpportunities)
      .set({ checklist: next, updatedBy: claims.sub })
      .where(eq(tenderOpportunities.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function setTenderChecklistItem(
  claims: UserClaims,
  id: string,
  itemId: string,
  done: boolean,
) {
  return withUser(claims, async (tx) => {
    const current = (
      await tx
        .select({ checklist: tenderOpportunities.checklist })
        .from(tenderOpportunities)
        .where(eq(tenderOpportunities.id, id))
        .limit(1)
    )[0];
    if (!current) return null;
    if (!current.checklist.some((c) => c.id === itemId)) return null;
    const next = current.checklist.map((c) =>
      c.id === itemId ? { ...c, done } : c,
    );
    const rows = await tx
      .update(tenderOpportunities)
      .set({ checklist: next, updatedBy: claims.sub })
      .where(eq(tenderOpportunities.id, id))
      .returning();
    return rows[0] ?? null;
  });
}
