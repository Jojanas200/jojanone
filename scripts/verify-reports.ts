/**
 * Verifies Reports/export: CSV projections are workspace-scoped (A's export
 * never contains B's rows), unknown datasets are rejected, and saved report
 * snapshots are RLS-isolated (list/save/delete).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-reports.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { createTenderOpportunity } from "../src/server/services/tender";
import {
  deleteReport,
  exportCsv,
  listReports,
  saveReport,
} from "../src/server/services/reports";
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
    userA = await createUser(`vrp-a-${stamp}@example.test`);
    userB = await createUser(`vrp-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VRp A", workspaceName: "VRp A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VRp B", workspaceName: "VRp B" },
    );

    await createTenderOpportunity(
      { sub: userA },
      wsA,
      createTenderOpportunitySchema.parse({
        title: "A framework, bid",
        authority: "Council A",
        contractValue: 5_000_000,
      }),
    );
    await createTenderOpportunity(
      { sub: userB },
      wsB,
      createTenderOpportunitySchema.parse({
        title: "B secret bid",
      }),
    );

    // --- CSV export ----------------------------------------------------------
    const csvA = await exportCsv({ sub: userA }, "tenders");
    check(
      "export returns a filename + csv",
      !!csvA && csvA.filename.endsWith(".csv"),
    );
    check(
      "csv has a header row",
      !!csvA && csvA.csv.startsWith("Opportunity,Authority"),
    );
    check(
      "csv contains A's row with commas quoted",
      !!csvA && csvA.csv.includes('"A framework, bid"'),
    );
    check(
      "csv formats money in major units",
      !!csvA && csvA.csv.includes("50000.00"),
    );
    check(
      "A's export never contains B's row",
      !!csvA && !csvA.csv.includes("secret"),
    );

    const csvUnknown = await exportCsv({ sub: userA }, "not_a_dataset");
    check("unknown dataset returns null", csvUnknown === null);

    // --- Saved snapshots -----------------------------------------------------
    const rep = await saveReport({ sub: userA }, wsA, {
      reportType: "executive_summary",
      title: "Board pack - test",
      summary: "Confidence 80/100",
      findings: ["Do the thing"],
      sourceModules: ["risk", "compliance"],
    });
    check("report snapshot saved", rep?.title === "Board pack - test");
    await saveReport({ sub: userB }, wsB, {
      reportType: "executive_summary",
      title: "B private report",
    });

    const listA = await listReports({ sub: userA });
    check(
      "A sees only its own snapshot",
      listA.length === 1 && listA[0].id === rep.id,
    );

    check(
      "B cannot delete A's snapshot",
      (await deleteReport({ sub: userB }, rep.id)) === false,
    );
    check(
      "A can delete own snapshot",
      (await deleteReport({ sub: userA }, rep.id)) === true,
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
