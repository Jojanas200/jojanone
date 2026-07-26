import { and, desc, eq, lt, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { scoreHistory } from "../db/schema";

/**
 * Daily Business Confidence Score snapshots → a REAL day-over-day delta. All
 * queries run through withUser() (RLS). Recording is best-effort: a read-only
 * member's page load can't write, so callers must ignore failures.
 */

export function recordScoreSnapshot(
  claims: UserClaims,
  workspaceId: string,
  score: number,
  statusLabel: string,
) {
  return withUser(claims, (tx) =>
    tx
      .insert(scoreHistory)
      .values({
        workspaceId,
        score,
        statusLabel,
        recordedOn: sql`current_date`,
      })
      .onConflictDoNothing({
        target: [scoreHistory.workspaceId, scoreHistory.recordedOn],
      }),
  );
}

export interface ScoreTrend {
  delta: number | null; // current − most recent prior day; null until history exists
  since: string | null; // the date that prior score was recorded (YYYY-MM-DD)
}

/**
 * Record today's score, then compare it to the most recent snapshot from a
 * PRIOR day. Returns a null delta until at least one earlier day exists, so we
 * never show a fabricated trend.
 */
export function getScoreTrend(
  claims: UserClaims,
  workspaceId: string,
  currentScore: number,
  statusLabel: string,
): Promise<ScoreTrend> {
  return withUser(claims, async (tx) => {
    try {
      await tx
        .insert(scoreHistory)
        .values({
          workspaceId,
          score: currentScore,
          statusLabel,
          recordedOn: sql`current_date`,
        })
        .onConflictDoNothing({
          target: [scoreHistory.workspaceId, scoreHistory.recordedOn],
        });
    } catch {
      // read-only member - snapshot not recorded; the delta below still works.
    }

    const prior = (
      await tx
        .select({
          score: scoreHistory.score,
          recordedOn: scoreHistory.recordedOn,
        })
        .from(scoreHistory)
        .where(
          and(
            eq(scoreHistory.workspaceId, workspaceId),
            lt(scoreHistory.recordedOn, sql`current_date`),
          ),
        )
        .orderBy(desc(scoreHistory.recordedOn))
        .limit(1)
    )[0];

    if (!prior) return { delta: null, since: null };
    return { delta: currentScore - prior.score, since: prior.recordedOn };
  });
}
