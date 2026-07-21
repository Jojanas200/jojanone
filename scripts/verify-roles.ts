/**
 * Verifies the role model end-to-end against real RLS:
 *  - write matrix: owner_admin / manager / team_member can mutate; adviser and
 *    read_only cannot (blocked by can_write_workspace at the database).
 *  - read access: every role can read the workspace's data.
 *  - getWorkspaceAccess (role / canWrite / scopedModules) matches per role.
 *  - adviser module-scoping (isModuleAllowed) reflects the stored allow-list.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-roles.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  memberships,
  organisations,
  workspaces,
} from "../src/server/db/schema";
import {
  createContract,
  listContracts,
} from "../src/server/services/contracts";
import {
  getWorkspaceAccess,
  isModuleAllowed,
} from "../src/server/services/workspaces";
import { requireModuleAccess } from "../src/server/auth/guard";
import { provisionWorkspace } from "../src/server/services/provisioning";

// The page guard redirects (throws NEXT_REDIRECT) when access is denied.
const guardBlocks = async (userId: string, key: string) => {
  try {
    await requireModuleAccess({ sub: userId }, key);
    return false;
  } catch {
    return true;
  }
};

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

async function canCreate(userId: string, ws: string): Promise<boolean> {
  try {
    await createContract({ sub: userId }, ws, {
      contractType: "customer",
      title: `probe-${userId.slice(0, 6)}`,
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const stamp = Date.now();
  const users: Record<string, string> = {};
  let wsA = "";

  try {
    for (const r of ["owner", "manager", "team", "adviser", "readonly"]) {
      users[r] = await createUser(`vrl-${r}-${stamp}@example.test`);
    }
    wsA = await provisionWorkspace(
      { sub: users.owner },
      { orgName: "Roles Co", workspaceName: "Roles Co" },
    );

    // Seed the other roles as members (adviser is scoped to two modules).
    await adminDb.insert(memberships).values([
      { workspaceId: wsA, userId: users.manager, role: "manager" },
      { workspaceId: wsA, userId: users.team, role: "team_member" },
      {
        workspaceId: wsA,
        userId: users.adviser,
        role: "adviser",
        scopedModules: ["compliance", "risk"],
      },
      { workspaceId: wsA, userId: users.readonly, role: "read_only" },
    ]);

    // --- Write matrix --------------------------------------------------------
    check("owner_admin can write", await canCreate(users.owner, wsA));
    check("manager can write", await canCreate(users.manager, wsA));
    check("team_member can write", await canCreate(users.team, wsA));
    check(
      "adviser CANNOT write (RLS-blocked)",
      !(await canCreate(users.adviser, wsA)),
    );
    check(
      "read_only CANNOT write (RLS-blocked)",
      !(await canCreate(users.readonly, wsA)),
    );

    // --- Read access (every role can read) ----------------------------------
    for (const r of ["owner", "manager", "team", "adviser", "readonly"]) {
      const rows = await listContracts({ sub: users[r] });
      check(`${r} can read the workspace's contracts`, rows.length >= 1);
    }

    // --- Access profile per role --------------------------------------------
    const accO = await getWorkspaceAccess({ sub: users.owner }, wsA);
    check(
      "owner access: canWrite, unscoped",
      accO.canWrite && accO.scopedModules === null,
    );
    const accM = await getWorkspaceAccess({ sub: users.manager }, wsA);
    check("manager access: canWrite", accM.canWrite && accM.role === "manager");
    const accR = await getWorkspaceAccess({ sub: users.readonly }, wsA);
    check(
      "read_only access: cannot write",
      accR.canWrite === false && accR.role === "read_only",
    );
    const accAd = await getWorkspaceAccess({ sub: users.adviser }, wsA);
    check(
      "adviser access: cannot write, scoped to [compliance, risk]",
      accAd.canWrite === false &&
        !!accAd.scopedModules &&
        accAd.scopedModules.includes("compliance") &&
        accAd.scopedModules.includes("risk") &&
        accAd.scopedModules.length === 2,
    );

    // --- Module scoping helper ----------------------------------------------
    check(
      "adviser scope allows an in-scope module",
      isModuleAllowed(accAd.scopedModules, "compliance"),
    );
    check(
      "adviser scope blocks an out-of-scope module",
      !isModuleAllowed(accAd.scopedModules, "hr"),
    );
    check(
      "unscoped (owner) allows every module",
      isModuleAllowed(accO.scopedModules, "hr"),
    );

    // --- Deep-link route guard (server-side) --------------------------------
    check(
      "adviser deep-link to an out-of-scope module is blocked",
      await guardBlocks(users.adviser, "hr"),
    );
    check(
      "adviser deep-link to an in-scope module is allowed",
      !(await guardBlocks(users.adviser, "compliance")),
    );
    check(
      "owner (unscoped) can reach any module",
      !(await guardBlocks(users.owner, "hr")),
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, [wsA]));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, [wsA]));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      for (const id of Object.values(users)) if (id) await deleteUser(id);
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
