/**
 * End-to-end verification of the Governance module against the REAL Supabase
 * project: provision → record create → isolation → status (approve) →
 * cross-tenant block → hard delete → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-governance.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createGovernanceRecord,
  deleteGovernanceRecord,
  listGovernanceRecords,
  setGovernanceStatus,
  updateGovernanceRecord,
} from "../src/server/services/governance";
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
    userA = await createUser(`vgov-a-${stamp}@example.test`);
    userB = await createUser(`vgov-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VGov A", workspaceName: "VGov A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VGov B", workspaceName: "VGov B" },
    );

    const rec = await createGovernanceRecord({ sub: userA }, wsA, {
      recordType: "board_meeting",
      title: "Approve office lease",
      decision: "Lease approved on tabled terms",
      decisionMaker: "Board",
    });
    check(
      "record created for A (defaults to draft/unapproved)",
      rec?.title === "Approve office lease" &&
        rec.status === "draft" &&
        rec.approvalStatus === "unapproved",
    );

    await createGovernanceRecord({ sub: userB }, wsB, {
      recordType: "director_decision",
      title: "Bank mandate change",
    });

    const aSees = await listGovernanceRecords({ sub: userA });
    const bSees = await listGovernanceRecords({ sub: userB });
    check(
      "A sees exactly 1 record",
      aSees.length === 1 && aSees[0].id === rec.id,
    );
    check("B sees exactly 1 record", bSees.length === 1);
    check(
      "A does NOT see B's record",
      !aSees.some((x) => x.title === "Bank mandate change"),
    );

    const approved = await setGovernanceStatus(
      { sub: userA },
      rec.id,
      "approved",
    );
    check(
      "approve flips approval_status",
      approved?.status === "approved" && approved.approvalStatus === "approved",
    );

    let blocked = false;
    try {
      await createGovernanceRecord({ sub: userA }, wsB, {
        recordType: "meeting_minutes",
        title: "hack",
      });
    } catch {
      blocked = true;
    }
    check("A cannot create in B's workspace (RLS)", blocked);

    const hijack = await updateGovernanceRecord({ sub: userB }, rec.id, {
      title: "hijacked",
    });
    check("B cannot update A's record (row hidden)", hijack === null);

    check(
      "A can hard-delete own record",
      (await deleteGovernanceRecord({ sub: userA }, rec.id)) === true,
    );
    check(
      "deleted record no longer listed",
      (await listGovernanceRecords({ sub: userA })).length === 0,
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
