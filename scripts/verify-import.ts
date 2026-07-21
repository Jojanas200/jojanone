/**
 * Verifies bulk import: CSV parsing + per-row validation (valid vs rejected),
 * atomic batch insert of only the valid rows, audit events, and tenant scoping.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-import.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { analyseCsv, commitImport } from "../src/server/services/import";
import { listContracts } from "../src/server/services/contracts";
import { listActivities } from "../src/server/services/activity";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 1 valid row + 3 that must be rejected (bad enum, missing title, bad money).
const CSV = [
  "title,contractType,counterparty,status,value,startDate,riskLevel",
  "Acme MSA,customer,Acme Ltd,active,12000.50,2026-01-01,medium",
  "Bad Type,not_a_type,Foo Ltd,active,100,,low",
  ",customer,No Title,active,50,,low",
  '"Quoted, Inc",customer,"Beta, LLC",draft,abc,,low',
].join("\n");

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
    // --- Pure validation (no DB) --------------------------------------------
    const preview = analyseCsv("contracts", CSV);
    check("preview parses 4 data rows", preview?.totalRows === 4);
    check("exactly 1 row is valid", preview?.validRows.length === 1);
    check("exactly 3 rows are rejected", preview?.errors.length === 3);
    check(
      "valid row converts pounds to minor units",
      preview?.validRows[0].valueMinor === 1_200_050,
    );
    check(
      "quoted field with comma parsed intact",
      preview?.errors.some((e) => e.row === 4 && /value/i.test(e.message)) ??
        false,
    );
    check("unknown dataset returns null", analyseCsv("nope", CSV) === null);

    // --- Commit against the DB ----------------------------------------------
    userA = await createUser(`vim-a-${stamp}@example.test`);
    userB = await createUser(`vim-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VIm A", workspaceName: "VIm A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VIm B", workspaceName: "VIm B" },
    );

    const result = await commitImport({ sub: userA }, wsA, "contracts", CSV);
    check("commit inserted only the valid row", result?.inserted === 1);
    check("commit reports the 3 skipped rows", result?.errors.length === 3);

    const contractsA = await listContracts({ sub: userA });
    check(
      "imported contract is readable by A",
      contractsA.length === 1 && contractsA[0].title === "Acme MSA",
    );
    check(
      "imported value persisted in minor units",
      contractsA[0].valueMinor === 1_200_050,
    );

    const feedA = await listActivities({ sub: userA }, 10);
    check(
      "import emitted an audit event",
      feedA.some(
        (a) => a.title === "Acme MSA" && a.description === "Contracts imported",
      ),
    );

    // Cross-tenant: B never sees A's imported rows.
    const contractsB = await listContracts({ sub: userB });
    check("B sees none of A's imported contracts", contractsB.length === 0);
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
