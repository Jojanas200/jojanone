import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { policies } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreatePolicyInput,
  UpdatePolicyInput,
} from "../../shared/schemas/policies";

/** Company policy register. All queries run through withUser() (RLS). */

export function listPolicies(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(policies)
      .orderBy(
        sql`${policies.reviewDate} asc nulls last`,
        desc(policies.updatedAt),
      ),
  );
}

export function getPolicy(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(policies)
      .where(eq(policies.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createPolicy(
  claims: UserClaims,
  workspaceId: string,
  input: CreatePolicyInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(policies)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "policies",
      action: "created",
      title: rows[0].policyName,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updatePolicy(
  claims: UserClaims,
  id: string,
  input: UpdatePolicyInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(policies)
      .set({ ...input, updatedBy: claims.sub, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "policies",
        action: "updated",
        title: row.policyName,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function setPolicyStatus(
  claims: UserClaims,
  id: string,
  status: string,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(policies)
      .set({
        status,
        // Publishing (active) stamps the approval date if not already set.
        ...(status === "active"
          ? {
              approvalDate: sql`coalesce(${policies.approvalDate}, current_date)`,
            }
          : {}),
        updatedBy: claims.sub,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "policies",
        action: status === "active" ? "completed" : "status changed",
        title: row.policyName,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function deletePolicy(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(policies)
      .where(eq(policies.id, id))
      .returning({ id: policies.id });
    return rows.length > 0;
  });
}
