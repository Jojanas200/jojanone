/**
 * End-to-end verification of the HR (employees) module against the REAL
 * Supabase project: provision → employee create → isolation → status update →
 * cross-tenant block → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-hr.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from "../src/server/services/hr";
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
    userA = await createUser(`vh-a-${stamp}@example.test`);
    userB = await createUser(`vh-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VH A", workspaceName: "VH A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VH B", workspaceName: "VH B" },
    );

    const emp = await createEmployee({ sub: userA }, wsA, {
      fullName: "Jordan Blake",
      jobTitle: "Support worker",
      employmentType: "employee",
      rightToWorkStatus: "outstanding",
      trainingStatus: "outstanding",
      riskLevel: "medium",
    });
    check(
      "employee created for A",
      emp?.fullName === "Jordan Blake" && emp.employmentStatus === "active",
    );
    check(
      "status fields defaulted",
      emp.rightToWorkStatus === "outstanding" &&
        emp.trainingStatus === "outstanding",
    );

    await createEmployee({ sub: userB }, wsB, {
      fullName: "Sam Rivers",
      employmentType: "contractor",
      rightToWorkStatus: "verified",
      trainingStatus: "complete",
      riskLevel: "low",
    });

    const aSees = await listEmployees({ sub: userA });
    const bSees = await listEmployees({ sub: userB });
    check(
      "A sees exactly 1 employee",
      aSees.length === 1 && aSees[0].id === emp.id,
    );
    check("B sees exactly 1 employee", bSees.length === 1);
    check(
      "A does NOT see B's employee",
      !aSees.some((x) => x.fullName === "Sam Rivers"),
    );

    const upd = await updateEmployee({ sub: userA }, emp.id, {
      rightToWorkStatus: "verified",
      employmentStatus: "probation",
    });
    check(
      "A can update RTW + status",
      upd?.rightToWorkStatus === "verified" &&
        upd.employmentStatus === "probation",
    );

    let blocked = false;
    try {
      await createEmployee({ sub: userA }, wsB, {
        fullName: "hack",
        employmentType: "employee",
      });
    } catch {
      blocked = true;
    }
    check("A cannot create in B's workspace (RLS)", blocked);

    const hijack = await updateEmployee({ sub: userB }, emp.id, {
      fullName: "hijacked",
    });
    check("B cannot update A's employee (row hidden)", hijack === null);

    check(
      "A can soft-delete own employee",
      (await deleteEmployee({ sub: userA }, emp.id)) === true,
    );
    check(
      "deleted employee no longer listed",
      (await listEmployees({ sub: userA })).length === 0,
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
