/**
 * End-to-end verification of Business Confidence Score history against the REAL
 * Supabase project: record snapshot (idempotent per day) → day-over-day delta →
 * RLS isolation → cleanup. A backdated prior-day row is inserted via adminDb so
 * the delta can be exercised without waiting a day.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-score-history.ts
 */
import { inArray, sql } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  organisations,
  scoreHistory,
  workspaces,
} from "../src/server/db/schema";
import {
  getScoreTrend,
  recordScoreSnapshot,
} from "../src/server/services/score-history";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
async function createUser(email: string): Promise<string> {
  const res = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Test-Passw0rd!",
      email_confirm: true,
    }),
  });
  if (!res.ok) throw new Error(`createUser: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; user?: { id: string } };
  const id = data.id ?? data.user?.id;
  if (!id) throw new Error("createUser: no id");
  return id;
}
const deleteUser = (id: string) =>
  adminFetch(`/users/${id}`, { method: "DELETE" });

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vscore-a-${stamp}@example.test`);
    userB = await createUser(`vscore-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VScore A", workspaceName: "VScore A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VScore B", workspaceName: "VScore B" },
    );
    const A = { sub: userA };
    const B = { sub: userB };

    // No prior history → no delta (never fabricated).
    const first = await getScoreTrend(A, wsA, 69, "Needs Attention");
    check("no prior history → null delta", first.delta === null);

    // Backdate a prior-day snapshot for A (score 65, 3 days ago) via adminDb.
    await adminDb.insert(scoreHistory).values({
      workspaceId: wsA,
      score: 65,
      statusLabel: "Needs Attention",
      recordedOn: sql`current_date - interval '3 days'`,
    });

    const trend = await getScoreTrend(A, wsA, 69, "Needs Attention");
    check("day-over-day delta computed (69 − 65 = +4)", trend.delta === 4);
    check("delta reports the prior date", !!trend.since);

    // Idempotent: today's row recorded once; a second call keeps the same delta.
    const again = await getScoreTrend(A, wsA, 72, "Needs Attention");
    // today's snapshot already exists (69), so it stays; delta = 72 − 65.
    check(
      "today's snapshot is not overwritten (still compares to prior day)",
      again.delta === 7,
    );
    const rowsToday = await adminDb
      .select({ id: scoreHistory.id })
      .from(scoreHistory)
      .where(
        sql`${scoreHistory.workspaceId} = ${wsA} and ${scoreHistory.recordedOn} = current_date`,
      );
    check("exactly one snapshot per day", rowsToday.length === 1);

    // RLS: B recording into their own ws doesn't touch A; A's history unseen by B.
    await recordScoreSnapshot(B, wsB, 50, "At Risk");
    const bTrend = await getScoreTrend(B, wsB, 50, "At Risk");
    check("B has its own history, no leakage from A", bTrend.delta === null);
    const bSeesA = await adminDb
      .select({ id: scoreHistory.id })
      .from(scoreHistory)
      .where(sql`${scoreHistory.workspaceId} = ${wsB}`);
    check("B's workspace has exactly its own snapshot", bSeesA.length === 1);
  } finally {
    console.log("Cleanup…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ids));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ids));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      if (userA) await deleteUser(userA);
      if (userB) await deleteUser(userB);
      console.log("  done");
    } catch (e) {
      console.log(`  cleanup warning: ${(e as Error).message}`);
    }
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
