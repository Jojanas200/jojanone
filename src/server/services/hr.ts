import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { employees } from "../db/schema";
import { recordActivity } from "./activity";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "../../shared/schemas/hr";

/** HR employees service. All queries run through withUser() (RLS). */

export function listEmployees(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(employees)
      .where(isNull(employees.deletedAt))
      .orderBy(asc(employees.fullName)),
  );
}

export function getEmployee(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createEmployee(
  claims: UserClaims,
  workspaceId: string,
  input: CreateEmployeeInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(employees)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "hr",
      action: "created",
      title: rows[0].fullName,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateEmployee(
  claims: UserClaims,
  id: string,
  input: UpdateEmployeeInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(employees)
      .set({ ...input, updatedBy: claims.sub })
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .returning();
    return rows[0] ?? null;
  });
}

export function deleteEmployee(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(employees)
      .set({ deletedAt: sql`now()`, updatedBy: claims.sub })
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .returning({
        id: employees.id,
        title: employees.fullName,
        workspaceId: employees.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "hr",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}
