/**
 * Verifies cross-tenant billing operations:
 *  - the funnel counts trialing/active/past_due/canceled;
 *  - MRR sums active-subscription plan prices; new-MRR + churn series populate;
 *  - the past-due list surfaces payment issues; recent billing_events appear.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-billing.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  billingEvents,
  organisations,
  subscriptions,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { getBillingOps } from "../src/server/services/platform-billing";

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
  const users: string[] = [];
  const ws: string[] = [];
  const evtId = `evt_verify_${stamp}`;

  try {
    // Four tenants, one per funnel state.
    for (let i = 0; i < 4; i++) {
      const u = await createUser(`bill-${i}-${stamp}@example.test`);
      users.push(u);
      const w = await provisionWorkspace(
        { sub: u },
        { orgName: `Bill ${i} ${stamp}`, workspaceName: `Bill ${i}` },
      );
      ws.push(w);
    }
    const [wsTrial, wsActive, wsPastDue, wsCanceled] = ws;

    await adminDb
      .update(subscriptions)
      .set({ status: "active", planKey: "growth" })
      .where(eq(subscriptions.workspaceId, wsActive));
    await adminDb
      .update(subscriptions)
      .set({ status: "past_due" })
      .where(eq(subscriptions.workspaceId, wsPastDue));
    await adminDb
      .update(subscriptions)
      .set({ status: "canceled", cancelAt: new Date() })
      .where(eq(subscriptions.workspaceId, wsCanceled));
    await adminDb.insert(billingEvents).values({
      workspaceId: wsTrial,
      stripeEventId: evtId,
      type: "invoice.payment_failed",
      payload: {},
    });

    const b = await getBillingOps();
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    check(
      "funnel counts every state we seeded",
      b.funnel.trialing >= 1 &&
        b.funnel.active >= 1 &&
        b.funnel.pastDue >= 1 &&
        b.funnel.canceled >= 1,
    );
    check("MRR is positive with an active subscription", b.mrrMinor > 0);
    check("ARR is 12x MRR", b.arrMinor === b.mrrMinor * 12);
    check(
      "conversion rate is a sane percentage",
      b.conversionRate >= 0 && b.conversionRate <= 100,
    );
    check(
      "new-MRR series has this month with revenue",
      b.newMrrByMonth.some((r) => r.month === month && r.mrrMinor > 0),
    );
    check(
      "churn series counts this month's cancellation",
      b.cancellationsByMonth.some((r) => r.month === month && r.count >= 1),
    );
    check(
      "past-due list surfaces the payment issue",
      b.pastDue.some((p) => p.workspaceId === wsPastDue),
    );
    check(
      "recent billing events include the seeded event",
      b.recentEvents.some((e) => e.type === "invoice.payment_failed"),
    );
  } finally {
    console.log("Cleanup…");
    try {
      await adminDb
        .delete(billingEvents)
        .where(eq(billingEvents.stripeEventId, evtId));
      if (ws.length) {
        await adminDb
          .delete(subscriptions)
          .where(inArray(subscriptions.workspaceId, ws));
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ws));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ws));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      for (const u of users) if (u) await deleteUser(u);
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
