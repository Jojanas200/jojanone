/**
 * Verifies HR actions (people tasks): create/update/complete/delete round-trips,
 * completed_at stamping, and strict tenant isolation (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-hr-actions.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  createHrAction,
  deleteHrAction,
  listHrActions,
  updateHrAction,
} from "../src/server/services/hr-actions";

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
    userA = await createUser(`vha-a-${stamp}@example.test`);
    userB = await createUser(`vha-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VHa A", workspaceName: "VHa A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VHa B", workspaceName: "VHa B" },
    );

    const a = await createHrAction({ sub: userA }, wsA, {
      actionType: "right_to_work",
      title: "Re-check RTW for new hire",
      priority: "high",
      status: "open",
    });
    check("action created open", a.status === "open" && a.completedAt === null);
    check(
      "A lists its one action",
      (await listHrActions({ sub: userA })).length === 1,
    );

    const done = await updateHrAction({ sub: userA }, a.id, {
      status: "completed",
    });
    check(
      "completing an action stamps completed_at",
      done?.status === "completed" && done.completedAt !== null,
    );

    check(
      "B sees none of A's actions (RLS)",
      (await listHrActions({ sub: userB })).length === 0,
    );
    check(
      "B cannot update A's action (row hidden)",
      (await updateHrAction({ sub: userB }, a.id, { status: "open" })) === null,
    );

    check(
      "A can delete its action",
      (await deleteHrAction({ sub: userA }, a.id)) === true,
    );
    check(
      "deleted action no longer listed",
      (await listHrActions({ sub: userA })).length === 0,
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
