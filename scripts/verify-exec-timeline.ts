/**
 * Verifies the read-only roll-ups (Executive totals + Timeline feed) are
 * workspace-scoped: user A's views never reflect user B's data. Seeds through
 * the real tender service (dated events), then reads via the roll-up services.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-exec-timeline.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createTenderOpportunity,
  updateTenderOpportunity,
} from "../src/server/services/tender";
import { getExecutiveTotals } from "../src/server/services/executive";
import { getTimeline } from "../src/server/services/timeline";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createTenderOpportunitySchema } from "../src/shared/schemas/tender";

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
    userA = await createUser(`vet-a-${stamp}@example.test`);
    userB = await createUser(`vet-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VEt A", workspaceName: "VEt A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VEt B", workspaceName: "VEt B" },
    );

    // A: one live opportunity with a deadline, one closed (won) - pipeline counts only the live one.
    const live = await createTenderOpportunity(
      { sub: userA },
      wsA,
      createTenderOpportunitySchema.parse({
        title: "A framework bid",
        contractValue: 5_000_000,
        submissionDeadline: "2026-12-01",
        status: "bid",
      }),
    );
    const won = await createTenderOpportunity(
      { sub: userA },
      wsA,
      createTenderOpportunitySchema.parse({
        title: "A closed deal",
        contractValue: 9_000_000,
      }),
    );
    await updateTenderOpportunity({ sub: userA }, won.id, { status: "won" });

    // B: unrelated opportunity that must never leak into A's views.
    await createTenderOpportunity(
      { sub: userB },
      wsB,
      createTenderOpportunitySchema.parse({
        title: "B secret bid",
        contractValue: 42_000_000,
        submissionDeadline: "2026-11-15",
        status: "bid",
      }),
    );

    // --- Executive totals ----------------------------------------------------
    const totals = await getExecutiveTotals({ sub: userA });
    check(
      "pipeline counts only the live opportunity",
      totals.tenderPipeline === 1,
    );
    check(
      "pipeline value excludes the closed deal",
      totals.tenderPipelineValue === 5_000_000,
    );
    check("A starts with zero active contracts", totals.activeContracts === 0);

    // --- Timeline ------------------------------------------------------------
    const feed = await getTimeline({ sub: userA });
    const tenderEvents = feed.filter((e) => e.module === "tender-ready");
    check(
      "timeline shows A's dated opportunity",
      tenderEvents.length === 1 && tenderEvents[0].title === "A framework bid",
    );
    check(
      "timeline never leaks B's events",
      !feed.some((e) => e.title.includes("secret")),
    );
    check(
      "timeline event links to the right module",
      tenderEvents[0]?.href === "/tender-ready",
    );

    // --- Cross-tenant: B's views are independent -----------------------------
    const bTotals = await getExecutiveTotals({ sub: userB });
    check(
      "B sees only its own pipeline",
      bTotals.tenderPipeline === 1 &&
        bTotals.tenderPipelineValue === 42_000_000,
    );
    const bFeed = await getTimeline({ sub: userB });
    check(
      "B's timeline shows only B's event",
      bFeed.filter((e) => e.module === "tender-ready").length === 1 &&
        bFeed.some((e) => e.title.includes("secret")),
    );

    void live;
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
