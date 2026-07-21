/**
 * Verifies cross-tenant tenant management (platform admin):
 *  - getPlatformWorkspaceDetail returns org, members (with emails), subscription;
 *  - listPlans returns the catalogue;
 *  - setSubscriptionOverride changes seats / plan / status (audited);
 *  - an unknown plan is rejected; trialDays sets a future period end + trialing;
 *  - listAuditLogForWorkspace scopes to the workspace.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-tenants.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  organisations,
  platformAuditLog,
  subscriptions,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  getPlatformWorkspaceDetail,
  listAuditLogForWorkspace,
  listPlans,
  setSubscriptionOverride,
} from "../src/server/services/platform-tenants";

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

const subRow = (workspaceId: string) =>
  adminDb
    .select({
      planKey: subscriptions.planKey,
      status: subscriptions.status,
      seatsAllowed: subscriptions.seatsAllowed,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1)
    .then((r) => r[0]);

async function main() {
  const stamp = Date.now();
  const emailA = `tenant-mgmt-${stamp}@example.test`;
  const actor = { sub: "", email: "tenants-verify@jojan.one" };
  let userA = "";
  let wsA = "";

  try {
    userA = await createUser(emailA);
    actor.sub = userA;
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Tenant Mgmt Co", workspaceName: "Tenant Mgmt Co" },
    );

    // --- Detail --------------------------------------------------------------
    const detail = await getPlatformWorkspaceDetail(wsA);
    check(
      "detail returns org, subscription and members with emails",
      !!detail &&
        detail.org === "Tenant Mgmt Co" &&
        detail.subscription?.planKey === "starter" &&
        detail.members.length === 1 &&
        detail.members[0].email === emailA,
    );

    const plans = await listPlans();
    check(
      "listPlans returns the catalogue (starter present)",
      plans.some((p) => p.key === "starter"),
    );

    // --- Overrides -----------------------------------------------------------
    const seatOverride = await setSubscriptionOverride(actor, wsA, {
      seatsAllowed: 25,
    });
    check(
      "seat override applies",
      seatOverride.ok === true && (await subRow(wsA))?.seatsAllowed === 25,
    );

    const planOverride = await setSubscriptionOverride(actor, wsA, {
      planKey: "growth",
      status: "active",
    });
    const afterPlan = await subRow(wsA);
    check(
      "plan + status override applies",
      planOverride.ok === true &&
        afterPlan?.planKey === "growth" &&
        afterPlan?.status === "active",
    );

    const badPlan = await setSubscriptionOverride(actor, wsA, {
      planKey: "not-a-plan",
    });
    check("an unknown plan is rejected", badPlan.ok === false);

    const trial = await setSubscriptionOverride(actor, wsA, { trialDays: 30 });
    const afterTrial = await subRow(wsA);
    check(
      "trial extension sets a future period end + trialing",
      trial.ok === true &&
        afterTrial?.status === "trialing" &&
        !!afterTrial?.currentPeriodEnd &&
        new Date(afterTrial.currentPeriodEnd).getTime() > Date.now(),
    );

    // --- Audit ---------------------------------------------------------------
    const audit = await listAuditLogForWorkspace(wsA, 50);
    check(
      "every override is audited and scoped to the tenant",
      audit.length >= 3 &&
        audit.every(
          (a) =>
            a.action === "subscription.override" && a.targetWorkspaceId === wsA,
        ),
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
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
