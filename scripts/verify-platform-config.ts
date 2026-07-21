/**
 * Verifies operator platform config (announcement + feature flags + plans):
 *  - an announcement persists and clears;
 *  - a module flag disables it globally (helpers reflect it);
 *  - plan edits persist; an unknown plan is rejected.
 *
 * Restores the original settings + plan and removes its audit rows on exit.
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-config.ts
 */
import { eq } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { platformAuditLog } from "../src/server/db/schema";
import {
  clearPlatformSettingsCache,
  disabledModuleKeys,
  getPlatformSettings,
  isModuleGloballyEnabled,
  updatePlatformSettings,
} from "../src/server/services/platform-settings";
import {
  listPlansFull,
  updatePlan,
} from "../src/server/services/platform-plans";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

const ACTOR = {
  sub: "00000000-0000-0000-0000-0000000000cf",
  email: "config-verify@jojan.one",
};

async function main() {
  const original = await getPlatformSettings();
  const plans = await listPlansFull();
  const starter = plans.find((p) => p.key === "starter");

  try {
    // --- Announcement --------------------------------------------------------
    await updatePlatformSettings(ACTOR, {
      announcement: "Scheduled maintenance tonight.",
      announcementLevel: "warning",
    });
    const withAnn = await getPlatformSettings();
    check(
      "announcement persists with level",
      withAnn.announcement === "Scheduled maintenance tonight." &&
        withAnn.announcementLevel === "warning",
    );
    await updatePlatformSettings(ACTOR, { announcement: null });
    check(
      "announcement clears",
      (await getPlatformSettings()).announcement === null,
    );

    // --- Feature flags (module kill-switch) ---------------------------------
    await updatePlatformSettings(ACTOR, {
      featureFlags: { "module.risk": false },
    });
    const flags = (await getPlatformSettings()).featureFlags;
    check(
      "a disabled module is reflected by the helpers",
      isModuleGloballyEnabled(flags, "risk") === false &&
        isModuleGloballyEnabled(flags, "hr") === true &&
        disabledModuleKeys(flags).includes("risk"),
    );

    // --- Plan catalogue ------------------------------------------------------
    const edit = await updatePlan(ACTOR, "starter", {
      name: "Starter (verify)",
      priceMinor: 4900,
    });
    const after = (await listPlansFull()).find((p) => p.key === "starter");
    check(
      "plan edit persists",
      edit.ok === true &&
        after?.name === "Starter (verify)" &&
        after?.priceMinor === 4900,
    );
    const bad = await updatePlan(ACTOR, "not-a-plan", { name: "x" });
    check("an unknown plan is rejected", bad.ok === false);
  } finally {
    // Restore settings.
    await updatePlatformSettings(ACTOR, {
      announcement: original.announcement,
      announcementLevel: original.announcementLevel,
      featureFlags: original.featureFlags,
    });
    // Restore the starter plan.
    if (starter)
      await updatePlan(ACTOR, "starter", {
        name: starter.name,
        priceMinor: starter.priceMinor,
      });
    clearPlatformSettingsCache();
    await adminDb
      .delete(platformAuditLog)
      .where(eq(platformAuditLog.actorEmail, ACTOR.email));
    console.log("  (restored settings + plan, removed test audit rows)");
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
