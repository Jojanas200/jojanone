/**
 * End-to-end verification of Settings (business profile + workspace + members)
 * against the REAL Supabase project: read seeded profile → update + completion
 * rescore → workspace rename → members list → cross-tenant blocks → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-settings.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  getBusinessProfile,
  getWorkspace,
  listMembers,
  updateBusinessProfile,
  updateWorkspace,
} from "../src/server/services/settings";
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
    userA = await createUser(`vst-a-${stamp}@example.test`);
    userB = await createUser(`vst-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VSt A", workspaceName: "VSt A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VSt B", workspaceName: "VSt B" },
    );

    // Provisioning seeded a business profile + owner_admin membership.
    const seeded = await getBusinessProfile({ sub: userA }, wsA);
    check("A has a seeded business profile", seeded !== null);

    const updated = await updateBusinessProfile({ sub: userA }, wsA, {
      businessName: "Acme Trading Ltd",
      companyNumber: "12345678",
      businessType: "Private limited company",
      industry: "Professional services",
      incorporationDate: "2020-04-01",
      registeredAddress: "1 High Street, London, EC1A 1BB",
      financialYearEnd: "31 March",
      annualRevenueBand: "£250k–£1m",
      employeeCount: 7,
      vatRegistered: true,
      processesPersonalData: true,
    });
    check(
      "A can update its profile",
      updated?.businessName === "Acme Trading Ltd",
    );
    check(
      "profile completion rescored to 100 (all 8 fields filled)",
      updated?.profileCompletion === 100,
    );
    check(
      "boolean flag persisted",
      updated?.vatRegistered === true && updated?.employeeCount === 7,
    );

    // Workspace rename.
    const ws = await updateWorkspace({ sub: userA }, wsA, {
      name: "Acme HQ",
      brandColor: "#4f46e5",
      timeZone: "Europe/London",
    });
    check(
      "A can rename its workspace",
      ws?.name === "Acme HQ" && ws?.brandColor === "#4f46e5",
    );
    const wsRead = await getWorkspace({ sub: userA }, wsA);
    check("rename persisted", wsRead?.name === "Acme HQ");

    // Members list contains the owner_admin membership for A.
    const members = await listMembers({ sub: userA }, wsA);
    check(
      "A sees itself as owner_admin member",
      members.length === 1 &&
        members[0].userId === userA &&
        members[0].role === "owner_admin",
    );

    // --- Cross-tenant isolation ---------------------------------------------
    const foreignProfile = await getBusinessProfile({ sub: userA }, wsB);
    check("A cannot read B's profile (RLS)", foreignProfile === null);
    const foreignWsUpdate = await updateWorkspace({ sub: userA }, wsB, {
      name: "hijacked",
    });
    check(
      "A cannot rename B's workspace (row hidden)",
      foreignWsUpdate === null,
    );
    const foreignProfileUpdate = await updateBusinessProfile(
      { sub: userA },
      wsB,
      {
        businessName: "hijacked",
      },
    );
    check(
      "A cannot update B's profile (row hidden)",
      foreignProfileUpdate === null,
    );
    const foreignMembers = await listMembers({ sub: userA }, wsB);
    check("A cannot list B's members (RLS)", foreignMembers.length === 0);
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
