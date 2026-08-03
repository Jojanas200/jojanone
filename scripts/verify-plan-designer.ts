/**
 * End-to-end verification of the package designer against the REAL Supabase
 * project: create a package, allocate optional modules, run the entitlement
 * rules, publish/withdraw (including the guards that stop a package reaching
 * the pricing page before it can be bought), free-trial packages, and archive.
 * Stripe is not called - packages are created free or priced without a Stripe
 * key present, and the sync degrades to a warning.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-plan-designer.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { plans } from "../src/server/db/schema";
import {
  archivePlan,
  createPlan,
  getPlan,
  listPlansFull,
  listPublishedPlans,
  setPlanPublished,
  updatePlan,
} from "../src/server/services/platform-plans";
import {
  CORE_MODULES,
  OPTIONAL_MODULES,
  isCoreModule,
  normaliseFeatures,
  planAllowsModule,
} from "../src/shared/plans/entitlements";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

const actor = {
  sub: "00000000-0000-0000-0000-000000000000",
  email: "verify@test.local",
  role: "operator" as const,
};

const KEY = `vpd-test-${Date.now().toString(36)}`.slice(0, 39);
const FREE_KEY = `${KEY}-f`.slice(0, 39);

async function main() {
  try {
    // --- Entitlement rules (pure) -------------------------------------------
    check(
      "score-critical modules are core and never sellable separately",
      [
        "compliance",
        "risk",
        "hr",
        "contracts",
        "gdpr",
        "governance",
        "policies",
        "evidence",
      ].every((k) => isCoreModule(k)),
    );
    check(
      "the designer never offers a core module as optional",
      OPTIONAL_MODULES.every((m) => !CORE_MODULES.includes(m.key as never)),
    );
    check(
      "core modules stay open on the leanest package",
      CORE_MODULES.every((k) => planAllowsModule([], k)),
    );
    check(
      "optional modules are withheld unless the package includes them",
      !planAllowsModule([], "academy") &&
        planAllowsModule(["academy"], "academy"),
    );
    check(
      "a workspace on no package keeps full access (never locked out)",
      planAllowsModule(null, "academy") && planAllowsModule(null, "jova"),
    );
    check(
      "unknown or core keys are stripped from a saved feature list",
      normaliseFeatures([
        "academy",
        "risk",
        "not-a-module",
        "academy",
      ]).join() === "academy",
    );

    // --- Create --------------------------------------------------------------
    const created = await createPlan(actor, {
      key: KEY,
      name: "Verify Package",
      description: "Created by the verifier.",
      priceMinor: 4900,
      currency: "GBP",
      billingInterval: "month",
      seatLimit: 3,
      features: ["academy", "reports", "risk"], // "risk" is core - must be dropped
      trialDays: 14,
    });
    check("package created", created.ok === true);
    const row = await getPlan(KEY);
    check(
      "stored with its trial, seats and only the optional modules",
      !!row &&
        row.trialDays === 14 &&
        row.seatLimit === 3 &&
        row.features.includes("academy") &&
        row.features.includes("reports") &&
        !row.features.includes("risk"),
    );
    check("new packages start as drafts, never live", row?.published === false);

    // --- The sidebar shows exactly what the package allows -------------------
    // Mirrors AppShell's inScope(): adviser scope AND kill-switches AND the
    // package. A module the server would refuse must never be listed.
    const navShows = (
      key: string,
      features: string[] | null,
      scoped: string[] | null = null,
      disabled: string[] = [],
    ) =>
      (!scoped || scoped.includes(key) || key === "settings") &&
      (key === "settings" || !disabled.includes(key)) &&
      (key === "settings" || planAllowsModule(features, key));

    const lean = ["academy"];
    check(
      "the sidebar hides optional modules the package excludes",
      navShows("academy", lean) &&
        !navShows("jova", lean) &&
        !navShows("reports", lean),
    );
    check(
      "core modules stay in the sidebar on every package",
      navShows("compliance", lean) &&
        navShows("risk", lean) &&
        navShows("policies", lean) &&
        navShows("settings", []),
    );
    check(
      "a workspace on no package still sees everything",
      navShows("jova", null) && navShows("reports", null),
    );
    check(
      "package entitlement does not override adviser scope or kill-switches",
      !navShows("academy", lean, ["compliance"]) &&
        !navShows("academy", lean, null, ["academy"]),
    );

    // --- Publish guards ------------------------------------------------------
    const priced = await getPlan(KEY);
    const blocked = await setPlanPublished(actor, KEY, true);
    const stripeless = priced?.stripePriceId === null;
    check(
      "a priced package cannot be published without a Stripe price",
      stripeless ? blocked.ok === false : blocked.ok === true,
    );

    // --- An unsynced priced package must be able to recover -----------------
    // Re-saving a package whose commercial terms have not changed must still
    // attempt the Stripe sync when it has no price yet, otherwise a package
    // that missed its first sync could never become sellable.
    const resave = await updatePlan(actor, KEY, { seatLimit: 3 });
    check(
      "re-saving an unsynced priced package retries the Stripe sync",
      resave.ok === true &&
        typeof (resave as { warning?: string | null }).warning === "string" &&
        ((resave as { warning?: string | null }).warning ?? "").includes(
          "Stripe is not connected",
        ),
    );

    // --- A free, time-bound trial package publishes cleanly -----------------
    const free = await createPlan(actor, {
      key: FREE_KEY,
      name: "Verify Free Trial",
      priceMinor: 0,
      trialDays: 30,
      features: ["jova"],
    });
    check("free package created", free.ok === true);
    const pub = await setPlanPublished(actor, FREE_KEY, true);
    check("a free package publishes without Stripe", pub.ok === true);
    const published = await listPublishedPlans();
    check(
      "published packages reach the public pricing list",
      published.some((p) => p.key === FREE_KEY),
    );
    check(
      "drafts stay off the public pricing list",
      !published.some((p) => p.key === KEY),
    );

    // --- Withdraw ------------------------------------------------------------
    await setPlanPublished(actor, FREE_KEY, false);
    check(
      "withdrawing removes it from the pricing page",
      !(await listPublishedPlans()).some((p) => p.key === FREE_KEY),
    );

    // --- Update --------------------------------------------------------------
    const upd = await updatePlan(actor, FREE_KEY, {
      features: ["jova", "academy", "timeline"],
      seatLimit: 10,
    });
    check("package updated", upd.ok === true);
    const after = await getPlan(FREE_KEY);
    check(
      "the new module allocation and seats are stored",
      !!after &&
        after.seatLimit === 10 &&
        after.features.length === 3 &&
        after.features.includes("timeline"),
    );
    check(
      "entitlements follow the saved allocation",
      planAllowsModule(after!.features, "timeline") &&
        !planAllowsModule(after!.features, "simulator"),
    );

    const dupe = await createPlan(actor, {
      key: FREE_KEY,
      name: "Duplicate",
      priceMinor: 0,
    });
    check("duplicate keys are refused", dupe.ok === false);

    const badTrial = await updatePlan(actor, FREE_KEY, { trialDays: 400 });
    check("an absurd trial length is refused", badTrial.ok === false);

    // --- Archive -------------------------------------------------------------
    const arch = await archivePlan(actor, FREE_KEY);
    check("package retired", arch.ok === true);
    const all = await listPlansFull();
    check(
      "retired packages disappear from the catalogue",
      !all.some((p) => p.key === FREE_KEY),
    );

    // --- Live catalogue untouched -------------------------------------------
    check(
      "the packages already being sold are still published",
      (await listPublishedPlans()).some((p) => p.key === "starter"),
    );
  } finally {
    console.log("Cleanup…");
    try {
      await adminDb.delete(plans).where(inArray(plans.key, [KEY, FREE_KEY]));
      console.log("  done");
    } catch (e) {
      console.log(`  cleanup warning: ${(e as Error).message}`);
    }
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

void eq;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
