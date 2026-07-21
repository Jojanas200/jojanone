import { and, asc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { employees, policies, policyAcknowledgements } from "../db/schema";
import { recordActivity } from "./activity";
import type { AssignAcknowledgementsInput } from "../../shared/schemas/policies";

/**
 * Per-employee policy sign-off. All queries run through withUser() (RLS).
 * The policy-level policies.acknowledgement_status rollup is recomputed here
 * from the roster whenever it changes.
 */

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/** Recompute policies.acknowledgement_status from the roster rows. */
async function recomputeRollup(tx: Tx, policyId: string, actorSub: string) {
  const rows = await tx
    .select({ status: policyAcknowledgements.status })
    .from(policyAcknowledgements)
    .where(eq(policyAcknowledgements.policyId, policyId));

  const total = rows.length;
  const resolved = rows.filter(
    (r) => r.status === "acknowledged" || r.status === "waived",
  ).length;

  const rollup =
    total === 0
      ? "not_started"
      : resolved === total
        ? "complete"
        : resolved > 0
          ? "partial"
          : "not_started";

  await tx
    .update(policies)
    .set({ acknowledgementStatus: rollup, updatedBy: actorSub })
    .where(eq(policies.id, policyId));

  return rollup;
}

/**
 * Recompute the HR-level employees.policy_acknowledgement_status flag from ALL
 * of that employee's roster rows across every policy: 'complete' when they have
 * assignments and all are resolved (acknowledged or waived), otherwise
 * 'outstanding'. Employees with no assignments are left untouched so a manual
 * HR value is never clobbered.
 */
async function recomputeEmployeeAckStatus(
  tx: Tx,
  employeeId: string,
  actorSub: string,
) {
  const rows = await tx
    .select({ status: policyAcknowledgements.status })
    .from(policyAcknowledgements)
    .where(eq(policyAcknowledgements.employeeId, employeeId));

  const total = rows.length;
  if (total === 0) return;
  const resolved = rows.filter(
    (r) => r.status === "acknowledged" || r.status === "waived",
  ).length;
  const flag = resolved === total ? "complete" : "outstanding";

  await tx
    .update(employees)
    .set({ policyAcknowledgementStatus: flag, updatedBy: actorSub })
    .where(and(eq(employees.id, employeeId), isNull(employees.deletedAt)));
}

/** Roster for a policy, with employee names joined in. */
export function listAcknowledgements(claims: UserClaims, policyId: string) {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: policyAcknowledgements.id,
        employeeId: policyAcknowledgements.employeeId,
        fullName: employees.fullName,
        jobTitle: employees.jobTitle,
        department: employees.department,
        status: policyAcknowledgements.status,
        acknowledgedAt: policyAcknowledgements.acknowledgedAt,
        policyVersion: policyAcknowledgements.policyVersion,
        notes: policyAcknowledgements.notes,
      })
      .from(policyAcknowledgements)
      .innerJoin(employees, eq(employees.id, policyAcknowledgements.employeeId))
      .where(eq(policyAcknowledgements.policyId, policyId))
      .orderBy(asc(employees.fullName)),
  );
}

/**
 * Assign a policy to specific employees and/or every active employee.
 * Idempotent (existing rows are left untouched). Returns the number of new
 * pending rows created, or null if the policy is not visible to the caller.
 */
export function assignAcknowledgements(
  claims: UserClaims,
  policyId: string,
  input: AssignAcknowledgementsInput,
) {
  return withUser(claims, async (tx) => {
    const pol = (
      await tx
        .select({
          id: policies.id,
          workspaceId: policies.workspaceId,
          policyName: policies.policyName,
        })
        .from(policies)
        .where(eq(policies.id, policyId))
        .limit(1)
    )[0];
    if (!pol) return null;

    // Resolve the target employee set, always intersected with the caller's own
    // (RLS-visible) active employees so a stray/foreign id can never be linked.
    const activeRows = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          isNull(employees.deletedAt),
          eq(employees.employmentStatus, "active"),
        ),
      );
    const activeIds = new Set(activeRows.map((r) => r.id));

    let targetIds: string[];
    if (input.allActive) {
      targetIds = [...activeIds];
    } else {
      targetIds = (input.employeeIds ?? []).filter((id) => activeIds.has(id));
    }
    if (targetIds.length === 0) return 0;

    const inserted = await tx
      .insert(policyAcknowledgements)
      .values(
        targetIds.map((employeeId) => ({
          workspaceId: pol.workspaceId,
          policyId,
          employeeId,
          status: "pending" as const,
          createdBy: claims.sub,
          updatedBy: claims.sub,
        })),
      )
      .onConflictDoNothing({
        target: [
          policyAcknowledgements.policyId,
          policyAcknowledgements.employeeId,
        ],
      })
      .returning({
        id: policyAcknowledgements.id,
        employeeId: policyAcknowledgements.employeeId,
      });

    if (inserted.length > 0) {
      // Requiring sign-off is now implied by having a roster.
      await tx
        .update(policies)
        .set({ acknowledgementRequired: true, updatedBy: claims.sub })
        .where(eq(policies.id, policyId));
      await recordActivity(tx, pol.workspaceId, {
        module: "policies",
        action: "updated",
        title: pol.policyName,
        referenceId: policyId,
      });
      for (const row of inserted)
        await recomputeEmployeeAckStatus(tx, row.employeeId, claims.sub);
    }

    await recomputeRollup(tx, policyId, claims.sub);
    return inserted.length;
  });
}

/**
 * Set one roster row's status. Acknowledging stamps the time and the policy
 * version signed; moving back to pending clears both. Returns the updated row,
 * or null if the row isn't part of this policy / not visible.
 */
export function setAcknowledgementStatus(
  claims: UserClaims,
  policyId: string,
  ackId: string,
  status: "pending" | "acknowledged" | "waived",
  notes?: string | null,
) {
  return withUser(claims, async (tx) => {
    const version =
      status === "acknowledged"
        ? ((
            await tx
              .select({ version: policies.version })
              .from(policies)
              .where(eq(policies.id, policyId))
              .limit(1)
          )[0]?.version ?? null)
        : null;

    const rows = await tx
      .update(policyAcknowledgements)
      .set({
        status,
        // Acknowledging stamps now + version; pending clears both; waived leaves
        // any prior stamp untouched (fields simply omitted from the SET).
        ...(status === "acknowledged"
          ? { acknowledgedAt: sql`now()`, policyVersion: version }
          : status === "pending"
            ? { acknowledgedAt: null, policyVersion: null }
            : {}),
        ...(notes !== undefined ? { notes } : {}),
        updatedBy: claims.sub,
      })
      .where(
        and(
          eq(policyAcknowledgements.id, ackId),
          eq(policyAcknowledgements.policyId, policyId),
        ),
      )
      .returning();

    const row = rows[0];
    if (!row) return null;

    await recomputeRollup(tx, policyId, claims.sub);
    await recomputeEmployeeAckStatus(tx, row.employeeId, claims.sub);
    return row;
  });
}

/** Remove a roster row. Returns true if a row was deleted. */
export function removeAcknowledgement(
  claims: UserClaims,
  policyId: string,
  ackId: string,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(policyAcknowledgements)
      .where(
        and(
          eq(policyAcknowledgements.id, ackId),
          eq(policyAcknowledgements.policyId, policyId),
        ),
      )
      .returning({
        id: policyAcknowledgements.id,
        employeeId: policyAcknowledgements.employeeId,
      });
    if (rows.length === 0) return false;
    await recomputeRollup(tx, policyId, claims.sub);
    await recomputeEmployeeAckStatus(tx, rows[0].employeeId, claims.sub);
    return true;
  });
}

/** Employees not yet on a policy's roster (for the assign picker). */
export function listUnassignedEmployees(claims: UserClaims, policyId: string) {
  return withUser(claims, async (tx) => {
    const assigned = await tx
      .select({ employeeId: policyAcknowledgements.employeeId })
      .from(policyAcknowledgements)
      .where(eq(policyAcknowledgements.policyId, policyId));
    const assignedIds = assigned.map((r) => r.employeeId);

    const base = and(
      isNull(employees.deletedAt),
      eq(employees.employmentStatus, "active"),
    );

    return tx
      .select({
        id: employees.id,
        fullName: employees.fullName,
        jobTitle: employees.jobTitle,
        department: employees.department,
      })
      .from(employees)
      .where(
        assignedIds.length
          ? and(base, notInArray(employees.id, assignedIds))
          : base,
      )
      .orderBy(asc(employees.fullName));
  });
}
