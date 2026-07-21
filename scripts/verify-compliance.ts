/**
 * End-to-end verification of the Compliance module against the REAL Supabase
 * project: provision → obligation CRUD + status via withUser() (RLS) →
 * tenant isolation → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-compliance.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createObligation,
  deleteObligation,
  listObligations,
  setObligationStatus,
  updateObligation,
} from "../src/server/services/compliance";
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
    userA = await createUser(`vc-a-${stamp}@example.test`);
    userB = await createUser(`vc-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VC A", workspaceName: "VC A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VC B", workspaceName: "VC B" },
    );
    check("two workspaces provisioned", !!wsA && !!wsB && wsA !== wsB);

    const oA = await createObligation({ sub: userA }, wsA, {
      title: "Confirmation statement (CS01)",
      category: "companies_house",
      priority: "high",
      status: "upcoming",
      recurrence: "annual",
      dueDate: "2026-09-30",
      professionalSupportRequired: false,
    });
    check(
      "obligation created for A",
      oA?.title === "Confirmation statement (CS01)",
    );
    check(
      "category + priority stored",
      oA.category === "companies_house" && oA.priority === "high",
    );

    await createObligation({ sub: userB }, wsB, {
      title: "VAT return",
      category: "vat",
      priority: "medium",
      status: "upcoming",
      recurrence: "quarterly",
      professionalSupportRequired: false,
    });

    const aSees = await listObligations({ sub: userA });
    const bSees = await listObligations({ sub: userB });
    check(
      "A sees exactly 1 obligation",
      aSees.length === 1 && aSees[0].id === oA.id,
    );
    check("B sees exactly 1 obligation", bSees.length === 1);
    check(
      "A does NOT see B's obligation",
      !aSees.some((o) => o.title === "VAT return"),
    );

    const done = await setObligationStatus({ sub: userA }, oA.id, "completed");
    check(
      "A can mark complete",
      done?.status === "completed" && done.completedAt !== null,
    );

    let blocked = false;
    try {
      await createObligation({ sub: userA }, wsB, {
        title: "hack",
        category: "other",
        priority: "low",
        status: "upcoming",
        recurrence: "none",
        professionalSupportRequired: false,
      });
    } catch {
      blocked = true;
    }
    check("A cannot create in B's workspace (RLS)", blocked);

    const hijack = await updateObligation({ sub: userB }, oA.id, {
      title: "hijacked",
    });
    check("B cannot update A's obligation (row hidden)", hijack === null);

    const del = await deleteObligation({ sub: userA }, oA.id);
    check("A can soft-delete own obligation", del === true);
    check(
      "deleted obligation no longer listed",
      (await listObligations({ sub: userA })).length === 0,
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
        const orgIds = orgRows.map((r) => r.org).filter(Boolean);
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
