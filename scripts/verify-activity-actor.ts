/**
 * Verifies per-user actor stamping on the activity feed:
 *  - recordActivity() run inside withUser() stamps actor_user_id from the JWT
 *    claims (no caller changes);
 *  - a service-role (adminDb) write leaves actor_user_id NULL (system);
 *  - listTenantActivity resolves the actor's email for the platform admin.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-activity-actor.ts
 */
import { and, eq, inArray } from "drizzle-orm";
import { adminDb, withUser } from "../src/server/db";
import { activities, organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { recordActivity } from "../src/server/services/activity";
import { listTenantActivity } from "../src/server/services/platform-audit";

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
  const emailA = `actor-${stamp}@example.test`;
  const userTitle = `Actor-stamped ${stamp}`;
  const systemTitle = `System-written ${stamp}`;
  let userA = "";
  let wsA = "";

  try {
    userA = await createUser(emailA);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Actor Co", workspaceName: "Actor Co" },
    );

    // 1) Activity written by a user, through the RLS transaction.
    await withUser({ sub: userA }, (tx) =>
      recordActivity(tx, wsA, {
        module: "risk",
        action: "created",
        title: userTitle,
      }),
    );

    // 2) Activity written by the service role (no claims) - system row.
    await adminDb.insert(activities).values({
      workspaceId: wsA,
      activityType: "risk",
      module: "risk",
      title: systemTitle,
      status: "info",
    });

    const stamped = (
      await adminDb
        .select({ actor: activities.actorUserId })
        .from(activities)
        .where(
          and(eq(activities.workspaceId, wsA), eq(activities.title, userTitle)),
        )
        .limit(1)
    )[0];
    check(
      "user-written activity is stamped with the acting user",
      stamped?.actor === userA,
    );

    const system = (
      await adminDb
        .select({ actor: activities.actorUserId })
        .from(activities)
        .where(
          and(
            eq(activities.workspaceId, wsA),
            eq(activities.title, systemTitle),
          ),
        )
        .limit(1)
    )[0];
    check(
      "service-role activity has no actor (system)",
      system?.actor === null,
    );

    const feed = await listTenantActivity({ module: "risk", limit: 200 });
    const mine = feed.find((a) => a.title === userTitle);
    const sys = feed.find((a) => a.title === systemTitle);
    check(
      "platform activity feed resolves the actor's email",
      mine?.actorEmail === emailA,
    );
    check(
      "system rows surface as no actor",
      sys !== undefined && sys.actorEmail === null,
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
        await adminDb.delete(activities).where(eq(activities.workspaceId, wsA));
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
