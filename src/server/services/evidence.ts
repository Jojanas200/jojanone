import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { complianceObligations, evidenceLibraryItems } from "../db/schema";
import { recordActivity } from "./activity";
import type { ConfirmEvidenceInput } from "../../shared/schemas/evidence";

// Evidence library + confirmation workflow. Recording evidence for an
// obligation and (optionally) completing it happen in ONE withUser()
// transaction, so the evidence item and the completed status are always
// consistent. All queries are RLS-scoped.

export function listEvidence(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(evidenceLibraryItems)
      .orderBy(desc(evidenceLibraryItems.createdAt)),
  );
}

export interface ConfirmEvidenceResult {
  evidenceId: string;
  obligationCompleted: boolean;
}

/**
 * Confirm evidence for a compliance obligation: record an evidence-library item
 * linked to it and, by default, mark the obligation complete + evidence-complete.
 * Returns null if the obligation isn't visible/writable (RLS).
 */
export function confirmObligationEvidence(
  claims: UserClaims,
  obligationId: string,
  input: ConfirmEvidenceInput,
): Promise<ConfirmEvidenceResult | null> {
  return withUser(claims, async (tx) => {
    // The obligation must exist and be writable by this user first.
    const ob = (
      await tx
        .select({
          id: complianceObligations.id,
          workspaceId: complianceObligations.workspaceId,
          title: complianceObligations.title,
        })
        .from(complianceObligations)
        .where(
          and(
            eq(complianceObligations.id, obligationId),
            isNull(complianceObligations.deletedAt),
          ),
        )
        .limit(1)
    )[0];
    if (!ob) return null;

    const inserted = await tx
      .insert(evidenceLibraryItems)
      .values({
        workspaceId: ob.workspaceId,
        category: input.category,
        title: input.title,
        notes: input.notes ?? null,
        fileName: input.fileName ?? null,
        reviewDate: input.reviewDate ?? null,
        sourceModule: "compliance",
        sourceRecordId: obligationId,
        status: "current",
      })
      .returning({ id: evidenceLibraryItems.id });

    let completed = false;
    if (input.completeObligation) {
      const upd = await tx
        .update(complianceObligations)
        .set({
          status: "completed",
          evidenceStatus: "complete",
          completedAt: sql`now()`,
          updatedBy: claims.sub,
        })
        .where(eq(complianceObligations.id, obligationId))
        .returning({ id: complianceObligations.id });
      completed = upd.length > 0;
    } else {
      await tx
        .update(complianceObligations)
        .set({ evidenceStatus: "collected", updatedBy: claims.sub })
        .where(eq(complianceObligations.id, obligationId));
    }

    await recordActivity(tx, ob.workspaceId, {
      module: "compliance",
      action: completed ? "completed" : "updated",
      title: ob.title,
      referenceId: obligationId,
      description: completed
        ? "Completed with evidence recorded"
        : "Evidence recorded",
    });

    return { evidenceId: inserted[0].id, obligationCompleted: completed };
  });
}
