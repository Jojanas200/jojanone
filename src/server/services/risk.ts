import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { risks } from "../db/schema";
import { recordActivity } from "./activity";
import { randomUUID } from "node:crypto";
import type {
  AddRiskMitigationInput,
  CreateRiskInput,
  RiskMitigation,
  UpdateRiskInput,
} from "../../shared/schemas/risk";

type Rating = "low" | "medium" | "high" | "critical";

/** 5×5 risk matrix rating from a likelihood×impact score. */
function rating(score: number): Rating {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

export function listRisks(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(risks)
      .where(isNull(risks.deletedAt))
      // highest residual risk first
      .orderBy(desc(risks.residualScore), desc(risks.inherentScore)),
  );
}

export function getRisk(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(risks)
      .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createRisk(
  claims: UserClaims,
  workspaceId: string,
  input: CreateRiskInput,
) {
  const inherentScore = input.likelihood * input.impact;
  const residualScore = input.residualLikelihood * input.residualImpact;
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(risks)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
        inherentScore,
        inherentRating: rating(inherentScore),
        residualScore,
        residualRating: rating(residualScore),
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "risk",
      action: "created",
      title: rows[0].riskTitle,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

/** Merge fields, then recompute both scores/ratings from the merged values. */
export function updateRisk(
  claims: UserClaims,
  id: string,
  input: UpdateRiskInput,
) {
  return withUser(claims, async (tx) => {
    const current = (
      await tx
        .select()
        .from(risks)
        .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
        .limit(1)
    )[0];
    if (!current) return null;

    const likelihood = input.likelihood ?? current.likelihood ?? 1;
    const impact = input.impact ?? current.impact ?? 1;
    const rLikelihood =
      input.residualLikelihood ?? current.residualLikelihood ?? 1;
    const rImpact = input.residualImpact ?? current.residualImpact ?? 1;
    const inherentScore = likelihood * impact;
    const residualScore = rLikelihood * rImpact;

    const rows = await tx
      .update(risks)
      .set({
        ...input,
        updatedBy: claims.sub,
        inherentScore,
        inherentRating: rating(inherentScore),
        residualScore,
        residualRating: rating(residualScore),
      })
      .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
      .returning();
    return rows[0] ?? null;
  });
}

/** open | accepted (records acceptance_reason) | closed (records closure_reason). */
export function setRiskStatus(
  claims: UserClaims,
  id: string,
  status: string,
  reason?: string | null,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(risks)
      .set({
        status,
        updatedBy: claims.sub,
        acceptedAt: status === "accepted" ? sql`now()` : null,
        closedAt: status === "closed" ? sql`now()` : null,
        acceptanceReason: status === "accepted" ? (reason ?? null) : null,
        closureReason: status === "closed" ? (reason ?? null) : null,
      })
      .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
      .returning();
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "risk",
        action: status === "closed" ? "completed" : "status changed",
        title: rows[0].riskTitle,
        referenceId: rows[0].id,
        description: `Risk marked ${status.replace(/_/g, " ")}`,
      });
    }
    return rows[0] ?? null;
  });
}

export function deleteRisk(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(risks)
      .set({ deletedAt: sql`now()`, updatedBy: claims.sub })
      .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
      .returning({
        id: risks.id,
        title: risks.riskTitle,
        workspaceId: risks.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "risk",
        action: "deleted",
        title: rows[0].title,
        referenceId: rows[0].id,
      });
    }
    return rows.length > 0;
  });
}

// --- Mitigation/treatment actions (embedded jsonb on the risk row) ----------

export function addRiskMitigation(
  claims: UserClaims,
  id: string,
  input: AddRiskMitigationInput,
) {
  return withUser(claims, async (tx) => {
    const current = (
      await tx
        .select({ mitigations: risks.mitigations })
        .from(risks)
        .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
        .limit(1)
    )[0];
    if (!current) return null;
    const next: RiskMitigation[] = [
      ...current.mitigations,
      {
        id: randomUUID(),
        label: input.label,
        dueDate: input.dueDate ?? null,
        completedAt: null,
      },
    ];
    const rows = await tx
      .update(risks)
      .set({ mitigations: next, updatedBy: claims.sub })
      .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
      .returning();
    return rows[0] ?? null;
  });
}

/** Mark a mitigation done/undone; the completion timestamp is server-set. */
export function setRiskMitigationDone(
  claims: UserClaims,
  id: string,
  mitigationId: string,
  done: boolean,
) {
  return withUser(claims, async (tx) => {
    const current = (
      await tx
        .select({ mitigations: risks.mitigations })
        .from(risks)
        .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
        .limit(1)
    )[0];
    if (!current) return null;
    if (!current.mitigations.some((m) => m.id === mitigationId)) return null;
    const next = current.mitigations.map((m) =>
      m.id === mitigationId
        ? { ...m, completedAt: done ? new Date().toISOString() : null }
        : m,
    );
    const rows = await tx
      .update(risks)
      .set({ mitigations: next, updatedBy: claims.sub })
      .where(and(eq(risks.id, id), isNull(risks.deletedAt)))
      .returning();
    return rows[0] ?? null;
  });
}
