/**
 * Verifies report generation against the REAL Supabase project: compose each of
 * the 6 report types from live data, persist, read back, rename, duplicate, and
 * confirm RLS isolation. Cleanup at the end.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-reports-gen.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  REPORT_CATALOG,
  composeReport,
  duplicateReport,
  getReport,
  listReports,
  renameReport,
  saveReport,
} from "../src/server/services/reports";
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
    userA = await createUser(`vrep-a-${stamp}@example.test`);
    userB = await createUser(`vrep-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VRep A", workspaceName: "VRep A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VRep B", workspaceName: "VRep B" },
    );
    const A = { sub: userA };
    const B = { sub: userB };

    // Compose + save each of the 6 report types.
    let composedAll = true;
    for (const meta of REPORT_CATALOG) {
      const input = await composeReport(A, meta.key, "Q1 2026");
      if (input.reportType !== meta.key || !input.title.trim())
        composedAll = false;
      const saved = await saveReport(A, wsA, input);
      if (!saved || saved.reportType !== meta.key || saved.status !== "final")
        composedAll = false;
    }
    check("all 6 report types compose + save from live data", composedAll);

    const list = await listReports(A);
    check("library lists the 6 generated reports", list.length === 6);
    check(
      "listReports returns status",
      list.every((r) => r.status === "final"),
    );

    const first = list[0];
    const full = await getReport(A, first.id);
    check(
      "getReport returns the full stored report",
      !!full && full.id === first.id && Array.isArray(full.metrics),
    );

    check(
      "rename updates the title",
      (await renameReport(A, first.id, "Renamed report")) === true,
    );
    check(
      "renamed title persists",
      (await getReport(A, first.id))?.title === "Renamed report",
    );

    const dup = await duplicateReport(A, first.id);
    check(
      "duplicate creates a (copy)",
      !!dup && dup.title === "Renamed report (copy)" && dup.id !== first.id,
    );
    check("library now has 7 reports", (await listReports(A)).length === 7);

    // --- RLS isolation ------------------------------------------------------
    check("B cannot read A's report", (await getReport(B, first.id)) === null);
    check(
      "B cannot rename A's report",
      (await renameReport(B, first.id, "hijack")) === false,
    );
    check(
      "B cannot duplicate A's report",
      (await duplicateReport(B, first.id)) === null,
    );
    check("B's library is empty", (await listReports(B)).length === 0);
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
