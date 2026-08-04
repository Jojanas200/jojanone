/**
 * Verifies trial provisioning, expiry and package intent:
 *  - a new workspace lands on the operator's designated trial package, not a
 *    hard-coded one, with the seats and trial length that package declares;
 *  - a live trial gets that package's entitlements;
 *  - a lapsed trial keeps every core module but loses the optional ones,
 *    rather than being locked out or silently keeping full access;
 *  - the package a visitor asks for is recorded as an intent and never as an
 *    entitlement, and an unpublished or invented key is discarded;
 *  - only one package can be the trial default;
 *  - RLS: neither tenant can read the other's subscription.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-trial.ts
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { adminDb, withUser } from "../src/server/db";
import {
  organisations,
  plans,
  subscriptions,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  planFeaturesFor,
  setIntendedPlan,
  trialHasLapsed,
  trialStateFor,
} from "../src/server/services/workspaces";
import { planAllowsModule } from "../src/shared/plans/entitlements";

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
  if (!res.ok) throw new Error(`createUser ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

async function deleteUser(id: string) {
  await adminFetch(`/users/${id}`, { method: "DELETE" });
}

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`trial-a-${stamp}@example.test`);
    userB = await createUser(`trial-b-${stamp}@example.test`);
    const claimsA = { sub: userA };
    const claimsB = { sub: userB };

    // The package the operator has designated, read before provisioning so the
    // assertions compare against the catalogue rather than a guess.
    const designatedRows = await adminDb
      .select({
        key: plans.key,
        trialDays: plans.trialDays,
        seatLimit: plans.seatLimit,
        features: plans.features,
      })
      .from(plans)
      .where(eq(plans.isTrialDefault, true))
      .limit(1);
    const designated = designatedRows[0];
    check("an operator has designated a trial package", !!designated);
    if (!designated) throw new Error("no trial package designated");

    // --- Provisioning -------------------------------------------------------
    // A asks for a package that does not exist; B asks for nothing.
    wsA = await provisionWorkspace(claimsA, {
      orgName: `Trial A ${stamp}`,
      workspaceName: `Trial A ${stamp}`,
      intendedPlan: "no-such-package",
    });
    wsB = await provisionWorkspace(claimsB, {
      orgName: `Trial B ${stamp}`,
      workspaceName: `Trial B ${stamp}`,
    });

    const subOf = async (ws: string) =>
      (
        await adminDb
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.workspaceId, ws))
          .limit(1)
      )[0];

    const subA = await subOf(wsA);
    const subB = await subOf(wsB);

    check(
      "a new workspace lands on the designated trial package",
      subA.planKey === designated.key && subB.planKey === designated.key,
    );
    check("a new workspace starts trialing", subA.status === "trialing");
    check(
      "seats come from the trial package, not a hard-coded 1",
      subA.seatsAllowed === (designated.seatLimit ?? 1),
    );

    const expected = designated.trialDays;
    if (expected > 0) {
      const days = Math.round(
        (subA.trialEndsAt!.getTime() - Date.now()) / 86_400_000,
      );
      check(
        `the trial ends in the package's own ${expected} days (got ${days})`,
        subA.trialEndsAt !== null && Math.abs(days - expected) <= 1,
      );
    } else {
      check(
        "a zero-day trial package sets no end date",
        subA.trialEndsAt === null,
      );
    }

    // --- Intent is recorded, never honoured ---------------------------------
    check(
      "an invented package key is discarded rather than stored",
      subA.intendedPlanKey === null,
    );
    check(
      "asking for a package does not change the package granted",
      subA.planKey === designated.key,
    );

    const published = await adminDb
      .select({ key: plans.key })
      .from(plans)
      .where(and(eq(plans.published, true), eq(plans.isSellable, true)))
      .limit(1);

    if (published[0]) {
      const stored = await setIntendedPlan(wsA, published[0].key);
      const after = await subOf(wsA);
      check(
        "a published package is accepted as the intent",
        stored && after.intendedPlanKey === published[0].key,
      );
      check(
        "recording an intent still does not change entitlement",
        after.planKey === designated.key,
      );
    }

    const rejected = await setIntendedPlan(wsA, "no-such-package");
    const afterReject = await subOf(wsA);
    check(
      "an unknown package is refused and leaves the intent alone",
      !rejected && afterReject.intendedPlanKey !== "no-such-package",
    );

    // --- Entitlement while the trial runs -----------------------------------
    const live = await planFeaturesFor(wsA);
    check(
      "a live trial gets the trial package's features",
      JSON.stringify(live) === JSON.stringify(designated.features),
    );

    const state = await trialStateFor(wsA);
    check(
      "the trial reports itself as live with days remaining",
      state.isTrial && !state.lapsed && (state.daysLeft ?? 0) > 0,
    );

    // --- Entitlement once it lapses -----------------------------------------
    check(
      "a trial with no end date never lapses",
      !trialHasLapsed("trialing", null),
    );
    check(
      "a paid subscription is never treated as a lapsed trial",
      !trialHasLapsed("active", new Date(Date.now() - 86_400_000)),
    );

    await adminDb
      .update(subscriptions)
      .set({ trialEndsAt: new Date(Date.now() - 86_400_000) })
      .where(eq(subscriptions.workspaceId, wsA));

    const lapsed = await planFeaturesFor(wsA);
    check(
      "a lapsed trial withdraws every optional module",
      Array.isArray(lapsed) && lapsed.length === 0,
    );
    check(
      "a lapsed trial keeps the core modules that derive the score",
      planAllowsModule(lapsed, "compliance") &&
        planAllowsModule(lapsed, "risk") &&
        planAllowsModule(lapsed, "policies"),
    );
    check(
      "a lapsed trial loses the optional modules",
      !planAllowsModule(lapsed, "jova") && !planAllowsModule(lapsed, "reports"),
    );
    const lapsedState = await trialStateFor(wsA);
    check(
      "the lapsed trial reports itself as lapsed with no days left",
      lapsedState.lapsed && lapsedState.daysLeft === 0,
    );
    check(
      "one workspace lapsing does not affect the other",
      ((await planFeaturesFor(wsB)) ?? []).length ===
        designated.features.length,
    );

    // --- Catalogue invariant ------------------------------------------------
    const trialDefaults = await adminDb
      .select({ key: plans.key })
      .from(plans)
      .where(eq(plans.isTrialDefault, true));
    check(
      "exactly one package is the trial default",
      trialDefaults.length === 1,
    );

    // Try to set a second trial default straight through the database. The
    // partial unique index must reject it; the catalogue is restored either
    // way so a missing index cannot leave the deployment misconfigured.
    let indexHeld = false;
    const other = await adminDb
      .select({ key: plans.key })
      .from(plans)
      .where(ne(plans.key, designated.key))
      .limit(1);
    if (other[0]) {
      try {
        await adminDb
          .update(plans)
          .set({ isTrialDefault: true })
          .where(eq(plans.key, other[0].key));
      } catch {
        indexHeld = true;
      } finally {
        await adminDb
          .update(plans)
          .set({ isTrialDefault: false })
          .where(ne(plans.key, designated.key));
        await adminDb
          .update(plans)
          .set({ isTrialDefault: true })
          .where(eq(plans.key, designated.key));
      }
    } else {
      indexHeld = true; // a single-package catalogue cannot collide
    }
    check("the database refuses a second trial default", indexHeld);
    check(
      "the designated package survives the attempt",
      (
        await adminDb
          .select({ key: plans.key })
          .from(plans)
          .where(eq(plans.isTrialDefault, true))
      ).length === 1,
    );

    // --- Tenant isolation ---------------------------------------------------
    const aSeesB = await withUser(claimsA, (tx) =>
      tx.select().from(subscriptions).where(eq(subscriptions.workspaceId, wsB)),
    );
    const bSeesA = await withUser(claimsB, (tx) =>
      tx.select().from(subscriptions).where(eq(subscriptions.workspaceId, wsA)),
    );
    check(
      "RLS: neither tenant can read the other's subscription",
      aSeesB.length === 0 && bSeesA.length === 0,
    );

    const aSeesOwn = await withUser(claimsA, (tx) =>
      tx.select().from(subscriptions).where(eq(subscriptions.workspaceId, wsA)),
    );
    check("RLS: a tenant can read its own subscription", aSeesOwn.length === 1);
  } finally {
    console.log("Cleanup...");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ids));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ids));
        const orgIds = orgRows.map((r) => r.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      for (const u of [userA, userB].filter(Boolean)) await deleteUser(u);
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
