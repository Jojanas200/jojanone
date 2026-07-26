import { desc, eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { scenarioRuns } from "../db/schema";
import { recordActivity } from "./activity";
import { type CreateScenarioRunInput } from "../../shared/schemas/scenarios";
import { generateScenarioResult } from "../../shared/scenarios/engine";

// Decision scenarios: a saved run of a decision playbook, recording which
// considerations are handled and a computed readiness result. RLS via withUser().

export function listScenarioRuns(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx.select().from(scenarioRuns).orderBy(desc(scenarioRuns.createdAt)),
  );
}

export function createScenarioRun(
  claims: UserClaims,
  workspaceId: string,
  input: CreateScenarioRunInput,
) {
  return withUser(claims, async (tx) => {
    // Deterministic advisory result from the questionnaire engine; the stored
    // shape keeps readiness/handled/total/outstanding for existing consumers.
    const result = generateScenarioResult(input.scenarioType, input.answers);
    const rows = await tx
      .insert(scenarioRuns)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        scenarioType: input.scenarioType,
        scenarioName: input.scenarioName,
        answers: input.answers,
        result: result as unknown as Record<string, unknown>,
        status: "complete",
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "simulator",
      action: "created",
      title: `Scenario: ${rows[0].scenarioName}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function deleteScenarioRun(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(scenarioRuns)
      .where(eq(scenarioRuns.id, id))
      .returning({ id: scenarioRuns.id });
    return rows.length > 0;
  });
}
