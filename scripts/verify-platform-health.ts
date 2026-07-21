/**
 * Verifies the system-health service:
 *  - a live DB round-trip reports "ok";
 *  - every integration is present with a presence-only status;
 *  - status reflects the environment (toggling a key flips it).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-health.ts
 */
import { getSystemHealth } from "../src/server/services/platform-health";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function main() {
  const saved = process.env.CRON_SECRET;
  try {
    const h = await getSystemHealth();
    check("database round-trip is ok", h.database === "ok");
    check("healthy mirrors the database check", h.healthy === true);

    const keys = h.integrations.map((i) => i.key);
    check(
      "all expected integrations are reported",
      [
        "stripe",
        "stripe_webhook",
        "ai",
        "email",
        "companies_house",
        "cache",
        "rate_limit",
        "cron",
      ].every((k) => keys.includes(k)),
    );
    check(
      "every integration has a presence-only status",
      h.integrations.every(
        (i) => i.status === "ok" || i.status === "not_configured",
      ),
    );

    // Config reflection: toggling CRON_SECRET flips the cron status.
    delete process.env.CRON_SECRET;
    const off = await getSystemHealth();
    check(
      "cron reads not_configured when the secret is absent",
      off.integrations.find((i) => i.key === "cron")?.status ===
        "not_configured",
    );
    process.env.CRON_SECRET = "test-secret";
    const on = await getSystemHealth();
    check(
      "cron reads ok when the secret is present",
      on.integrations.find((i) => i.key === "cron")?.status === "ok",
    );
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
