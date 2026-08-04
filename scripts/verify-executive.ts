/**
 * Verifies the Executive extras against the REAL Supabase project:
 * listPendingDecisions (real governance records awaiting sign-off) and
 * getGrowthSignals (honest due-diligence + tender facts), with RLS isolation.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-executive.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  getGrowthSignals,
  listPendingDecisions,
} from "../src/server/services/executive";
import {
  createGovernanceRecord,
  setGovernanceStatus,
} from "../src/server/services/governance";
import { createDueDiligenceItem } from "../src/server/services/investor";
import { createTenderOpportunity } from "../src/server/services/tender";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createDueDiligenceItemSchema } from "../src/shared/schemas/investor";

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

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vexec-a-${stamp}@example.test`);
    userB = await createUser(`vexec-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VExec A", workspaceName: "VExec A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VExec B", workspaceName: "VExec B" },
    );
    const A = { sub: userA };
    const B = { sub: userB };

    // --- decisions required (real governance records) ----------------------
    const pending = await createGovernanceRecord(A, wsA, {
      recordType: "meeting_minutes",
      title: "Sign off Q2 board minutes",
    });
    const toApprove = await createGovernanceRecord(A, wsA, {
      recordType: "director_decision",
      title: "Approve cyber insurance renewal",
    });
    await setGovernanceStatus(A, toApprove.id, "approved");

    const decisions = await listPendingDecisions(A);
    check(
      "pending decision (draft) is listed",
      decisions.some((d) => d.id === pending.id),
    );
    check(
      "approved record is NOT listed as a decision",
      !decisions.some((d) => d.id === toApprove.id),
    );

    // --- growth signals (honest facts) -------------------------------------
    await createDueDiligenceItem(
      A,
      wsA,
      createDueDiligenceItemSchema.parse({
        title: "Cap table",
        category: "corporate",
        status: "ready",
      }),
    );
    await createDueDiligenceItem(
      A,
      wsA,
      createDueDiligenceItemSchema.parse({
        title: "Management accounts",
        category: "financial",
        status: "missing",
      }),
    );
    await createTenderOpportunity(
      A,
      wsA,
      createTenderOpportunitySchema.parse({
        title: "Council services framework",
        contractValue: 500000,
        submissionDeadline: inDays(10),
      }),
    );

    const g = await getGrowthSignals(A);
    check("due-diligence ready count", g.ddReady === 1);
    check("due-diligence total (excludes N/A)", g.ddTotal === 2);
    check("active tender counted", g.tenderActive === 1);
    check("tender value summed", g.tenderValueMinor === 500000);
    check("tender deadline within 30 days counted", g.tenderDeadlines30d === 1);

    // --- RLS isolation ------------------------------------------------------
    check(
      "B sees no decisions from A",
      (await listPendingDecisions(B)).length === 0,
    );
    const gb = await getGrowthSignals(B);
    check(
      "B's growth signals are all zero (no leakage)",
      gb.ddReady === 0 &&
        gb.ddTotal === 0 &&
        gb.tenderActive === 0 &&
        gb.tenderValueMinor === 0 &&
        gb.tenderDeadlines30d === 0,
    );
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
