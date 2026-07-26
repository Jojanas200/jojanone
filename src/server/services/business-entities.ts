import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { businessEntities } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateEntityInput,
  UpdateEntityInput,
} from "../../shared/schemas/business-entities";

// Key parties register (customers, suppliers, advisers, regulators, banks…),
// the managed layer behind the Business Map. RLS-scoped via withUser().

export function listEntities(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(businessEntities)
      .where(isNull(businessEntities.deletedAt))
      .orderBy(desc(businessEntities.updatedAt)),
  );
}

export function createEntity(
  claims: UserClaims,
  workspaceId: string,
  input: CreateEntityInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(businessEntities)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "business-map",
      action: "created",
      title: rows[0].name,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateEntity(
  claims: UserClaims,
  id: string,
  input: UpdateEntityInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(businessEntities)
      .set({ ...input, updatedBy: claims.sub })
      .where(
        and(eq(businessEntities.id, id), isNull(businessEntities.deletedAt)),
      )
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteEntity(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(businessEntities)
      .set({ deletedAt: sql`now()`, updatedBy: claims.sub })
      .where(
        and(eq(businessEntities.id, id), isNull(businessEntities.deletedAt)),
      )
      .returning({ id: businessEntities.id });
    return rows.length > 0;
  });
}
