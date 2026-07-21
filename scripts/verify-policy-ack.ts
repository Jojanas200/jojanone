/**
 * End-to-end verification of per-employee Policy sign-off against the REAL
 * Supabase project: assign → roster → acknowledge/waive rollup → cross-workspace
 * employee guard → RLS isolation → remove → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-policy-ack.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { createPolicy, getPolicy } from "../src/server/services/policies";
import {
  assignAcknowledgements,
  listAcknowledgements,
  removeAcknowledgement,
  setAcknowledgementStatus,
} from "../src/server/services/policy-acknowledgements";
import { createEmployee, getEmployee } from "../src/server/services/hr";
import { createEmployeeSchema } from "../src/shared/schemas/hr";
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

const emp = (fullName: string) => createEmployeeSchema.parse({ fullName });

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vpolack-a-${stamp}@example.test`);
    userB = await createUser(`vpolack-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VPolAck A", workspaceName: "VPolAck A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VPolAck B", workspaceName: "VPolAck B" },
    );

    const alice = await createEmployee({ sub: userA }, wsA, emp("Alice Doe"));
    await createEmployee({ sub: userA }, wsA, emp("Bob Roe"));
    const eve = await createEmployee({ sub: userB }, wsB, emp("Eve Hunt"));

    const pol = await createPolicy({ sub: userA }, wsA, {
      policyName: "Acceptable Use Policy",
      policyCategory: "IT & security",
      version: "2.0",
    });

    const created = await assignAcknowledgements({ sub: userA }, pol.id, {
      allActive: true,
    });
    check("assign-all created 2 pending rows", created === 2);

    const afterAssign = await getPolicy({ sub: userA }, pol.id);
    check(
      "assigning flips acknowledgement_required true",
      afterAssign?.acknowledgementRequired === true,
    );
    check(
      "rollup is not_started while all pending",
      afterAssign?.acknowledgementStatus === "not_started",
    );

    let roster = await listAcknowledgements({ sub: userA }, pol.id);
    check(
      "roster shows 2 people, all pending",
      roster.length === 2 && roster.every((r) => r.status === "pending"),
    );
    check(
      "HR flag outstanding while a policy is pending",
      (await getEmployee({ sub: userA }, alice.id))
        ?.policyAcknowledgementStatus === "outstanding",
    );

    const aliceRow = roster.find((r) => r.employeeId === alice.id)!;
    const acked = await setAcknowledgementStatus(
      { sub: userA },
      pol.id,
      aliceRow.id,
      "acknowledged",
    );
    check(
      "acknowledge stamps time + version signed",
      acked?.status === "acknowledged" &&
        acked.acknowledgedAt !== null &&
        acked.policyVersion === "2.0",
    );
    check(
      "rollup becomes partial after 1 of 2",
      (await getPolicy({ sub: userA }, pol.id))?.acknowledgementStatus ===
        "partial",
    );
    check(
      "HR flag complete once their only policy is signed",
      (await getEmployee({ sub: userA }, alice.id))
        ?.policyAcknowledgementStatus === "complete",
    );

    const bobRow = roster.find((r) => r.employeeId !== alice.id)!;
    check(
      "other employee's HR flag still outstanding",
      (await getEmployee({ sub: userA }, bobRow.employeeId))
        ?.policyAcknowledgementStatus === "outstanding",
    );
    await setAcknowledgementStatus({ sub: userA }, pol.id, bobRow.id, "waived");
    check(
      "rollup becomes complete when all resolved (ack + waived)",
      (await getPolicy({ sub: userA }, pol.id))?.acknowledgementStatus ===
        "complete",
    );
    check(
      "waived employee's HR flag becomes complete",
      (await getEmployee({ sub: userA }, bobRow.employeeId))
        ?.policyAcknowledgementStatus === "complete",
    );

    // Cross-policy: a second policy re-opens the employee-level flag until signed.
    const pol2 = await createPolicy({ sub: userA }, wsA, {
      policyName: "Remote Working Policy",
      version: "1.0",
    });
    await assignAcknowledgements({ sub: userA }, pol2.id, {
      employeeIds: [alice.id],
    });
    check(
      "HR flag reopens to outstanding when a new policy is assigned",
      (await getEmployee({ sub: userA }, alice.id))
        ?.policyAcknowledgementStatus === "outstanding",
    );
    const alicePol2 = (
      await listAcknowledgements({ sub: userA }, pol2.id)
    ).find((r) => r.employeeId === alice.id)!;
    await setAcknowledgementStatus(
      { sub: userA },
      pol2.id,
      alicePol2.id,
      "acknowledged",
    );
    check(
      "HR flag complete again once every assigned policy is signed",
      (await getEmployee({ sub: userA }, alice.id))
        ?.policyAcknowledgementStatus === "complete",
    );

    // Cross-workspace employee guard: A cannot enrol B's employee.
    const foreign = await assignAcknowledgements({ sub: userA }, pol.id, {
      employeeIds: [eve.id],
    });
    check("A cannot assign B's employee (filtered → 0)", foreign === 0);

    // RLS isolation.
    check(
      "B cannot see A's roster",
      (await listAcknowledgements({ sub: userB }, pol.id)).length === 0,
    );
    check(
      "B cannot assign to A's policy (not found)",
      (await assignAcknowledgements({ sub: userB }, pol.id, {
        allActive: true,
      })) === null,
    );
    check(
      "B cannot change A's roster row (row hidden)",
      (await setAcknowledgementStatus(
        { sub: userB },
        pol.id,
        aliceRow.id,
        "pending",
      )) === null,
    );

    // Remove the acknowledged row; the waived one remains → still complete.
    check(
      "A can remove a roster row",
      (await removeAcknowledgement({ sub: userA }, pol.id, aliceRow.id)) ===
        true,
    );
    roster = await listAcknowledgements({ sub: userA }, pol.id);
    check("roster now has 1 person", roster.length === 1);
    check(
      "rollup recomputes to complete (remaining is waived)",
      (await getPolicy({ sub: userA }, pol.id))?.acknowledgementStatus ===
        "complete",
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
