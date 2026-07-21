/**
 * Verifies the cross-tenant audit + activity logs (platform admin):
 *  - operator actions list, with the target workspace name resolved;
 *  - action filter narrows the operator log; listAuditActions surfaces it;
 *  - tenant activity lists across tenants with workspace + org names;
 *  - module filter narrows activity; listActivityModules surfaces it.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-audit.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  activities,
  organisations,
  platformAuditLog,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { logPlatformAction } from "../src/server/services/platform-admin";
import {
  listActivityModules,
  listAuditActions,
  listOperatorAudit,
  listTenantActivity,
} from "../src/server/services/platform-audit";

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
  const uniqueAction = `verify.audit.${stamp}`;
  const actor = { sub: "", email: `audit-verify-${stamp}@jojan.one` };
  let userA = "";
  let wsA = "";

  try {
    userA = await createUser(`audit-${stamp}@example.test`);
    actor.sub = userA;
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Audit Co", workspaceName: "Audit Co" },
    );

    // Seed one operator action + one tenant activity.
    await logPlatformAction(actor, uniqueAction, { targetWorkspaceId: wsA });
    await adminDb.insert(activities).values({
      workspaceId: wsA,
      activityType: "risk",
      module: "risk",
      title: `Audit-test risk ${stamp}`,
      status: "open",
    });

    // --- Operator audit ------------------------------------------------------
    const filtered = await listOperatorAudit({ action: uniqueAction });
    check(
      "operator audit filters by action + resolves the tenant name",
      filtered.length === 1 &&
        filtered[0].targetWorkspaceId === wsA &&
        filtered[0].targetWorkspaceName === "Audit Co",
    );

    const actions = await listAuditActions();
    check("action appears in the filter list", actions.includes(uniqueAction));

    const unfiltered = await listOperatorAudit({ limit: 200 });
    check(
      "unfiltered operator audit returns at least the seeded action",
      unfiltered.some((r) => r.action === uniqueAction),
    );

    // --- Tenant activity -----------------------------------------------------
    const risk = await listTenantActivity({ module: "risk", limit: 200 });
    const mine = risk.find((a) => a.workspaceId === wsA);
    check(
      "tenant activity lists with workspace + org names, filtered by module",
      !!mine && mine.workspaceName === "Audit Co" && mine.org === "Audit Co",
    );

    const hr = await listTenantActivity({ module: "hr", limit: 200 });
    check(
      "module filter excludes other modules",
      !hr.some((a) => a.workspaceId === wsA),
    );

    const modules = await listActivityModules();
    check("module appears in the filter list", modules.includes("risk"));
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
        await adminDb.delete(activities).where(eq(activities.workspaceId, wsA));
        await adminDb
          .delete(platformAuditLog)
          .where(eq(platformAuditLog.targetWorkspaceId, wsA));
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(eq(workspaces.id, wsA));
        await adminDb.delete(workspaces).where(eq(workspaces.id, wsA));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      if (userA) await deleteUser(userA);
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
