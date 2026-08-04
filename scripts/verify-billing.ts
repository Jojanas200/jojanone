/**
 * Verifies M4 billing: read model + seat accounting, Stripe webhook processing
 * (canonical subscription state, idempotent on event id), plan/seat transitions,
 * tenant isolation, and the guarantee that core features are NEVER paywalled.
 *
 * Stripe keys are not required - webhook processing is exercised with synthetic
 * events; the not-configured/price paths of session creation are asserted too.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-billing.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  billingEvents,
  organisations,
  // Aliased: a local `plans` holds the sellable catalogue further down.
  plans as plansTable,
  subscriptions,
  workspaces,
} from "../src/server/db/schema";
import {
  getBillingOverview,
  hasSeatAvailable,
  listSellablePlans,
} from "../src/server/services/billing";
import { processStripeEvent } from "../src/server/services/billing-webhook";
import { createCheckoutSession } from "../src/server/services/billing-sessions";
import { exportCsv } from "../src/server/services/reports";
import { getJovaBriefing } from "../src/server/services/jova";
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

const readSub = async (workspaceId: string) =>
  (
    await adminDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1)
  )[0];

async function main() {
  const stamp = Date.now();
  const evStamp = `evt_${stamp}`;
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";
  const savedKey = process.env.STRIPE_SECRET_KEY;

  try {
    delete process.env.STRIPE_SECRET_KEY; // ensure "not configured" path

    userA = await createUser(`vbl-a-${stamp}@example.test`);
    userB = await createUser(`vbl-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VBl A", workspaceName: "VBl A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VBl B", workspaceName: "VBl B" },
    );

    // --- Read model ----------------------------------------------------------
    const plans = await listSellablePlans({ sub: userA });
    const sellable = plans.filter((p) => p.isSellable).map((p) => p.key);
    const notSellable = plans.filter((p) => !p.isSellable).map((p) => p.key);
    check(
      "the sellable catalogue is offered and non-sellable packages are withheld",
      sellable.length > 0 &&
        sellable.includes("starter") &&
        notSellable.every((k) => !sellable.includes(k)),
    );

    // The trial package is an operator decision, so these assert against the
    // catalogue rather than against a package key someone can change.
    const trialRows = await adminDb
      .select({ key: plansTable.key, seatLimit: plansTable.seatLimit })
      .from(plansTable)
      .where(eq(plansTable.isTrialDefault, true))
      .limit(1);
    const trialPkg = trialRows[0];
    const trialSeats = trialPkg?.seatLimit ?? 1;

    const ov0 = await getBillingOverview({ sub: userA }, wsA);
    check(
      "a fresh workspace trials the designated package with its own seats",
      !!trialPkg &&
        ov0?.planKey === trialPkg.key &&
        ov0?.status === "trialing" &&
        ov0?.seatsAllowed === trialSeats,
    );
    check(
      "the owner occupies exactly one of those seats",
      ov0?.seatsUsed === 1 && ov0?.seatsAvailable === trialSeats - 1,
    );
    check(
      "seat availability follows the trial package's seat limit",
      (await hasSeatAvailable({ sub: userA }, wsA)) === trialSeats > 1,
    );

    // --- Session creation guards (no live Stripe call) -----------------------
    const noKey = await createCheckoutSession(wsA, "growth", "a@example.test");
    check(
      "checkout without a key returns 503",
      !noKey.ok && noKey.code === 503,
    );
    // Use a key that does not exist rather than a real package: operators now
    // manage the real catalogue, and once a package syncs to Stripe it HAS a
    // price - asserting the opposite would break the moment billing works.
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    delete process.env.STRIPE_PRICE_GROWTH;
    const noPrice = await createCheckoutSession(
      wsA,
      "no-such-package",
      "a@example.test",
    );
    check(
      "checkout without a configured price returns 400",
      !noPrice.ok && noPrice.code === 400,
    );
    delete process.env.STRIPE_SECRET_KEY;

    // --- Webhook: checkout completed → active Growth -------------------------
    const checkoutEvt = {
      id: `${evStamp}_checkout`,
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: wsA,
          customer: "cus_TESTA",
          subscription: "sub_TESTA",
          metadata: { workspace_id: wsA, plan_key: "growth" },
        },
      },
    };
    const r1 = await processStripeEvent(checkoutEvt);
    check(
      "checkout event processed",
      r1.processed && r1.action === "checkout-completed",
    );
    const s1 = await readSub(wsA);
    check(
      "subscription is now active Growth with 5 seats",
      s1.status === "active" &&
        s1.planKey === "growth" &&
        s1.seatsAllowed === 5,
    );
    check(
      "stripe customer + subscription ids stored",
      s1.stripeCustomerId === "cus_TESTA" &&
        s1.stripeSubscriptionId === "sub_TESTA",
    );

    // Seat accounting reflects the upgrade.
    const ov1 = await getBillingOverview({ sub: userA }, wsA);
    check(
      "Growth frees up seats",
      ov1?.seatsAllowed === 5 && ov1?.seatsAvailable === 4,
    );
    check(
      "Growth has a seat available",
      (await hasSeatAvailable({ sub: userA }, wsA)) === true,
    );

    // --- Idempotency: replaying the same event id changes nothing ------------
    const r2 = await processStripeEvent(checkoutEvt);
    check(
      "replayed event is a no-op (duplicate)",
      !r2.processed && r2.action === "duplicate",
    );
    const evCount = (
      await adminDb
        .select({ id: billingEvents.id })
        .from(billingEvents)
        .where(eq(billingEvents.stripeEventId, `${evStamp}_checkout`))
    ).length;
    check("event recorded exactly once", evCount === 1);

    // --- Payment failed → past_due, then invoice paid → active ---------------
    await processStripeEvent({
      id: `${evStamp}_failed`,
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_TESTA" } },
    });
    check(
      "payment failure sets past_due",
      (await readSub(wsA)).status === "past_due",
    );
    await processStripeEvent({
      id: `${evStamp}_paid`,
      type: "invoice.paid",
      data: { object: { customer: "cus_TESTA" } },
    });
    check(
      "invoice paid restores active",
      (await readSub(wsA)).status === "active",
    );

    // --- Cancellation --------------------------------------------------------
    await processStripeEvent({
      id: `${evStamp}_deleted`,
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_TESTA",
          customer: "cus_TESTA",
          metadata: { workspace_id: wsA },
        },
      },
    });
    check(
      "cancellation sets canceled status",
      (await readSub(wsA)).status === "canceled",
    );

    // --- Never paywalled: core features work even when canceled --------------
    const csv = await exportCsv({ sub: userA }, "contracts");
    check(
      "exports work regardless of billing status",
      !!csv && csv.csv.startsWith("Title,"),
    );
    const jova = await getJovaBriefing({ sub: userA });
    check(
      "Jova findings work regardless of billing status",
      typeof jova.total === "number",
    );

    // --- Cross-tenant --------------------------------------------------------
    const foreign = await getBillingOverview({ sub: userA }, wsB);
    check("A cannot read B's billing overview (RLS)", foreign === null);
    const ovB = await getBillingOverview({ sub: userB }, wsB);
    check(
      "B still sees its own untouched trial",
      ovB?.planKey === trialPkg?.key && ovB?.status === "trialing",
    );
  } finally {
    if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedKey;
    console.log("Cleanup…");
    try {
      await adminDb
        .delete(billingEvents)
        .where(
          inArray(billingEvents.stripeEventId, [
            `${evStamp}_checkout`,
            `${evStamp}_failed`,
            `${evStamp}_paid`,
            `${evStamp}_deleted`,
          ]),
        );
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
