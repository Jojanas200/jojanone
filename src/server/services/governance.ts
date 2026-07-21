import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { governanceRecords } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateGovernanceRecordInput,
  UpdateGovernanceRecordInput,
} from "../../shared/schemas/governance";

/** Governance records service. All queries run through withUser() (RLS). */

export function listGovernanceRecords(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(governanceRecords)
      .orderBy(
        sql`${governanceRecords.meetingDate} desc nulls last`,
        desc(governanceRecords.createdAt),
      ),
  );
}

export function getGovernanceRecord(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(governanceRecords)
      .where(eq(governanceRecords.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createGovernanceRecord(
  claims: UserClaims,
  workspaceId: string,
  input: CreateGovernanceRecordInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(governanceRecords)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "governance",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateGovernanceRecord(
  claims: UserClaims,
  id: string,
  input: UpdateGovernanceRecordInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(governanceRecords)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(governanceRecords.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

/** Advance status; 'approved'/'completed' also flip approval_status to approved. */
export function setGovernanceStatus(
  claims: UserClaims,
  id: string,
  status: string,
) {
  const approved = status === "approved" || status === "completed";
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(governanceRecords)
      .set({
        status,
        approvalStatus: approved ? "approved" : "unapproved",
        updatedBy: claims.sub,
      })
      .where(eq(governanceRecords.id, id))
      .returning();
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "governance",
        action: "status changed",
        title: rows[0].title,
        referenceId: rows[0].id,
        description: `Governance record marked ${status.replace(/_/g, " ")}`,
      });
    }
    return rows[0] ?? null;
  });
}

export function deleteGovernanceRecord(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(governanceRecords)
      .where(eq(governanceRecords.id, id))
      .returning({
        id: governanceRecords.id,
        title: governanceRecords.title,
        workspaceId: governanceRecords.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "governance",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}
