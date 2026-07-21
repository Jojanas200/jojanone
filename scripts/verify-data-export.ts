/**
 * Verifies the tenant data-portability export (runs under RLS):
 *  - returns the caller's own workspace records (contracts, activities, etc.);
 *  - does NOT include another tenant's records (isolation);
 *  - exporting a workspace you don't belong to returns null (RLS blocks the read).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-data-export.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  activities,
  notifications,
  organisations,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { getWorkspaceExport } from "../src/server/services/data-export";

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
    userA = await createUser(`export-a-${stamp}@example.test`);
    userB = await createUser(`export-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Export A", workspaceName: "Export A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "Export B", workspaceName: "Export B" },
    );

    // Seed distinguishable records in each workspace.
    await adminDb.insert(activities).values([
      {
        workspaceId: wsA,
        activityType: "risk",
        module: "risk",
        title: `A-activity-${stamp}`,
        status: "open",
      },
      {
        workspaceId: wsB,
        activityType: "risk",
        module: "risk",
        title: `B-activity-${stamp}`,
        status: "open",
      },
    ]);
    await adminDb.insert(notifications).values({
      workspaceId: wsA,
      kind: "priority",
      title: `A-notif-${stamp}`,
    });

    // --- Own-workspace export ------------------------------------------------
    const exp = await getWorkspaceExport({ sub: userA }, wsA);
    const acts = (exp?.records.activities ?? []) as { title: string }[];
    const notifs = (exp?.records.notifications ?? []) as { title: string }[];
    check(
      "export returns the workspace identity + owner membership",
      !!exp &&
        exp.workspace.name === "Export A" &&
        (exp.members as { role: string }[]).some(
          (m) => m.role === "owner_admin",
        ),
    );
    check(
      "export includes this workspace's records",
      acts.some((a) => a.title === `A-activity-${stamp}`) &&
        notifs.some((n) => n.title === `A-notif-${stamp}`),
    );
    check(
      "export EXCLUDES another tenant's records (isolation)",
      !acts.some((a) => a.title === `B-activity-${stamp}`),
    );

    // --- RLS: cannot export a workspace you don't belong to ------------------
    const foreign = await getWorkspaceExport({ sub: userA }, wsB);
    check(
      "exporting a foreign workspace returns null (RLS blocks the read)",
      foreign === null,
    );
  } finally {
    console.log("Cleanup…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        await adminDb
          .delete(activities)
          .where(inArray(activities.workspaceId, ids));
        await adminDb
          .delete(notifications)
          .where(inArray(notifications.workspaceId, ids));
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
      for (const u of [userA, userB]) if (u) await deleteUser(u);
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
