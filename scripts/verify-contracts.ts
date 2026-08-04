/**
 * End-to-end verification against the REAL Supabase project.
 *
 * Proves the vertical slice: create auth users → provision_workspace() →
 * Contracts CRUD through withUser() (RLS-as-user) → tenant isolation → cleanup.
 *
 * Run:  set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-contracts.ts
 *
 * Requires env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Creates two temporary users + workspaces and DELETES them at the end.
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createContract,
  listContracts,
  updateContract,
  deleteContract,
} from "../src/server/services/contracts";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { contractIssues } from "../app/(app)/contracts/issues";

import { createContractSchema } from "../src/shared/schemas/contract";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
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
  if (!res.ok)
    throw new Error(`createUser ${email}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; user?: { id: string } };
  const id = data.id ?? data.user?.id;
  if (!id) throw new Error(`createUser ${email}: no id in response`);
  return id;
}

async function deleteUser(id: string) {
  await adminFetch(`/users/${id}`, { method: "DELETE" });
}

async function main() {
  const stamp = Date.now();
  const emailA = `verify-a-${stamp}@example.test`;
  const emailB = `verify-b-${stamp}@example.test`;

  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    console.log("1) Create two auth users");
    userA = await createUser(emailA);
    userB = await createUser(emailB);
    check("user A created", !!userA);
    check("user B created", !!userB);

    console.log(
      "2) Provision a workspace for each (via provision_workspace RPC, RLS)",
    );
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Verify A", workspaceName: "Verify A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "Verify B", workspaceName: "Verify B" },
    );
    check("workspace A provisioned", !!wsA);
    check("workspace B provisioned", !!wsB && wsB !== wsA);

    console.log(
      "3) Create a contract in each workspace (Contracts service, withUser)",
    );
    const cA = await createContract(
      { sub: userA },
      wsA,
      createContractSchema.parse({
        contractType: "customer",
        title: "A – Acme MSA",
      }),
    );
    const cB = await createContract(
      { sub: userB },
      wsB,
      createContractSchema.parse({
        contractType: "supplier",
        title: "B – Globex SLA",
      }),
    );
    check(
      "contract A created",
      cA?.title === "A – Acme MSA" && cA.workspaceId === wsA,
    );
    check(
      "contract B created",
      cB?.title === "B – Globex SLA" && cB.workspaceId === wsB,
    );

    console.log("4) Tenant isolation on reads");
    const aSees = await listContracts({ sub: userA });
    const bSees = await listContracts({ sub: userB });
    check(
      "A sees exactly 1 contract",
      aSees.length === 1 && aSees[0].id === cA.id,
    );
    check(
      "B sees exactly 1 contract",
      bSees.length === 1 && bSees[0].id === cB.id,
    );
    check("A does NOT see B's contract", !aSees.some((c) => c.id === cB.id));

    console.log("5) Update + soft-delete through withUser");
    const upd = await updateContract({ sub: userA }, cA.id, {
      status: "active",
      riskLevel: "medium",
    });
    check(
      "A can update own contract",
      upd?.status === "active" && upd.riskLevel === "medium",
    );
    const del = await deleteContract({ sub: userA }, cA.id);
    check("A can soft-delete own contract", del === true);
    const aAfterDelete = await listContracts({ sub: userA });
    check("soft-deleted contract no longer listed", aAfterDelete.length === 0);

    console.log("5b) Full-field create + issues engine");
    const cFull = await createContract({ sub: userA }, wsA, {
      contractType: "office",
      title: "A - Office lease",
      counterparty: "Landlord Ltd",
      status: "active",
      currency: "EUR",
      valueMinor: 1200000,
      startDate: "2024-01-01",
      endDate: "2024-06-30",
      noticePeriodDays: 30,
      riskLevel: "high",
      keyTerms: "5-year term, upward-only rent review",
      obligations: "Quarterly rent in advance; internal repairs",
      nextAction: "Serve break notice",
      nextActionDate: "2024-05-01",
      notes: "Created by verifier",
    });
    check(
      "full-field contract persists (currency/terms/next action)",
      cFull.currency === "EUR" &&
        cFull.keyTerms === "5-year term, upward-only rent review" &&
        cFull.nextAction === "Serve break notice" &&
        cFull.noticePeriodDays === 30,
    );
    const issues = contractIssues(cFull);
    check(
      "issues engine flags expired-but-active and overdue action",
      issues.some((i) => i.includes("still marked active")) &&
        issues.some((i) => i.includes("overdue")),
    );
    check(
      "issues engine is quiet for a healthy draft",
      contractIssues({
        status: "draft",
        endDate: null,
        owner: null,
        noticePeriodDays: null,
        nextAction: null,
        nextActionDate: null,
      }).length === 0,
    );
    check(
      "full-field contract can be removed",
      (await deleteContract({ sub: userA }, cFull.id)) === true,
    );

    console.log("6) Cross-tenant WRITE is blocked by RLS");
    let blocked = false;
    try {
      await createContract(
        { sub: userA },
        wsB,
        createContractSchema.parse({
          contractType: "other",
          title: "hack",
        }),
      );
    } catch {
      blocked = true;
    }
    check("A cannot create a contract in B's workspace", blocked);

    console.log("7) Cross-tenant UPDATE is a no-op (RLS hides the row)");
    const hijack = await updateContract({ sub: userB }, cA.id, {
      title: "hijacked",
    });
    check("B cannot update A's contract (row invisible)", hijack === null);
  } finally {
    console.log("Cleanup: removing test workspaces, organisations and users…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ids));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ids)); // cascades
        const orgIds = orgRows.map((r) => r.org).filter(Boolean);
        if (orgIds.length) {
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
        }
      }
      if (userA) await deleteUser(userA);
      if (userB) await deleteUser(userB);
      console.log("  cleanup done");
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
