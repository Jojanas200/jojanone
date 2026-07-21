import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { contracts } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateContractInput,
  UpdateContractInput,
} from "../../shared/schemas/contract";

/**
 * Contracts service. Every function runs through `withUser()`, so RLS decides
 * which rows are visible/writable - callers never pass a workspace filter for
 * reads, and writes are checked against the caller's role in Postgres.
 */

export function listContracts(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(contracts)
      .where(isNull(contracts.deletedAt))
      .orderBy(desc(contracts.updatedAt)),
  );
}

export function getContract(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createContract(
  claims: UserClaims,
  workspaceId: string,
  input: CreateContractInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(contracts)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "contracts",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateContract(
  claims: UserClaims,
  id: string,
  input: UpdateContractInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ ...input, updatedBy: claims.sub })
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)))
      .returning();
    return rows[0] ?? null;
  });
}

/** Soft delete (records deleted_at; row is preserved for audit/retention). */
export function deleteContract(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ deletedAt: sql`now()`, updatedBy: claims.sub })
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)))
      .returning({
        id: contracts.id,
        title: contracts.title,
        workspaceId: contracts.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "contracts",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}
