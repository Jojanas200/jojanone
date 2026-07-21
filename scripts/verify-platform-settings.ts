/**
 * Verifies platform settings + live LLM selection:
 *  - the singleton reads with a default (anthropic);
 *  - updatePlatformSettings persists, busts the read cache, and is audited;
 *  - getActiveProvider() reflects the admin's provider + model choice live;
 *  - "deterministic" forces the non-configured provider (Jova fallback);
 *  - a blank model resolves to the provider default.
 *
 * Restores the original settings + removes its own audit rows on exit.
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-settings.ts
 */
import { eq } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { platformAuditLog } from "../src/server/db/schema";
import {
  clearPlatformSettingsCache,
  effectiveModel,
  getActiveAiConfig,
  getPlatformSettings,
  updatePlatformSettings,
} from "../src/server/services/platform-settings";
import {
  ANTHROPIC_DEFAULT_MODEL,
  getActiveProvider,
} from "../src/server/ai/provider";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

const ACTOR = {
  sub: "00000000-0000-0000-0000-0000000000aa",
  email: "settings-verify@jojan.one",
};

async function main() {
  const original = await getPlatformSettings();

  try {
    check(
      "settings read with a provider default",
      ["anthropic", "openrouter", "deterministic"].includes(
        original.aiProvider,
      ),
    );

    // Choose OpenRouter + a specific model.
    await updatePlatformSettings(ACTOR, {
      aiProvider: "openrouter",
      aiModel: "meta-llama/llama-3.1-70b",
      signupsEnabled: true,
    });
    const s1 = await getPlatformSettings();
    check(
      "update persists provider + model (cache busted)",
      s1.aiProvider === "openrouter" &&
        s1.aiModel === "meta-llama/llama-3.1-70b",
    );

    const cfg = await getActiveAiConfig();
    check(
      "active AI config reflects the choice",
      cfg.provider === "openrouter" && cfg.model === "meta-llama/llama-3.1-70b",
    );

    const p1 = await getActiveProvider();
    check(
      "live provider is OpenRouter with the chosen model",
      p1.name === "openrouter" && p1.model === "meta-llama/llama-3.1-70b",
    );

    // Blank model resolves to the provider default.
    await updatePlatformSettings(ACTOR, {
      aiProvider: "anthropic",
      aiModel: "",
      signupsEnabled: true,
    });
    const p2 = await getActiveProvider();
    check(
      "blank model resolves to the provider default",
      p2.name === "anthropic" && p2.model === ANTHROPIC_DEFAULT_MODEL,
    );
    check(
      "effectiveModel helper resolves the default",
      effectiveModel("anthropic", null) === ANTHROPIC_DEFAULT_MODEL,
    );

    // Deterministic forces the non-configured provider (Jova fallback).
    await updatePlatformSettings(ACTOR, {
      aiProvider: "deterministic",
      aiModel: "",
      signupsEnabled: false,
    });
    const p3 = await getActiveProvider();
    check(
      "deterministic provider is never configured (forces fallback)",
      p3.name === "deterministic" && p3.isConfigured() === false,
    );
    const s3 = await getPlatformSettings();
    check("signups toggle persists", s3.signupsEnabled === false);

    // Audit trail.
    const audits = await adminDb
      .select({ action: platformAuditLog.action })
      .from(platformAuditLog)
      .where(eq(platformAuditLog.actorEmail, ACTOR.email));
    check(
      "each settings change is audited",
      audits.length >= 3 && audits.every((a) => a.action === "settings.update"),
    );
  } finally {
    // Restore the original settings so prod config is unchanged.
    await updatePlatformSettings(ACTOR, {
      aiProvider: original.aiProvider,
      aiModel: original.aiModel ?? "",
      signupsEnabled: original.signupsEnabled,
    });
    clearPlatformSettingsCache();
    await adminDb
      .delete(platformAuditLog)
      .where(eq(platformAuditLog.actorEmail, ACTOR.email));
    console.log("  (restored original settings, removed test audit rows)");
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
