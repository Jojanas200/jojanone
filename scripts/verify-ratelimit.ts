/**
 * Verifies the rate limiter (build-now, keys-later):
 *  - unconfigured (no Upstash) = in-memory fallback, still enforces per key;
 *  - a fixed window blocks past the limit and resets after it elapses;
 *  - distinct keys are independent;
 *  - enforceRateLimit() returns null then a 429 with Retry-After;
 *  - configuration flag flips when Upstash env is present.
 *
 * No database needed. Run: ./node_modules/.bin/tsx scripts/verify-ratelimit.ts
 */
import {
  checkRateLimit,
  clientKey,
  enforceRateLimit,
  isRateLimitConfigured,
} from "../src/server/security/rate-limit";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function main() {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedTok = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    check(
      "unconfigured without Upstash env",
      isRateLimitConfigured() === false,
    );

    // Fixed window of 3 per 60s, deterministic clock.
    const t0 = 1_000_000;
    const key = `k-${t0}`;
    const r1 = await checkRateLimit(key, 3, 60, t0);
    const r2 = await checkRateLimit(key, 3, 60, t0 + 1);
    const r3 = await checkRateLimit(key, 3, 60, t0 + 2);
    const r4 = await checkRateLimit(key, 3, 60, t0 + 3);
    check(
      "first 3 hits allowed, 4th blocked",
      r1.ok && r2.ok && r3.ok && r4.ok === false,
    );
    check(
      "remaining counts down to 0",
      r1.remaining === 2 && r4.remaining === 0,
    );

    // After the window elapses the key resets.
    const r5 = await checkRateLimit(key, 3, 60, t0 + 60_001);
    check("window resets after it elapses", r5.ok === true);

    // A different key is independent.
    const other = await checkRateLimit(`other-${t0}`, 3, 60, t0 + 4);
    check("a different key has its own budget", other.ok === true);

    // clientKey derives from x-forwarded-for.
    const req = new Request("http://x/api/team/invite", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    check(
      "client key uses the first forwarded IP",
      clientKey(req, "b") === "b:203.0.113.7",
    );

    // enforceRateLimit: first passes (null), second is a 429 with Retry-After.
    const ip = { "x-forwarded-for": "198.51.100.9" };
    const mk = () =>
      new Request("http://x/api/team/transfer", {
        method: "POST",
        headers: ip,
      });
    const first = await enforceRateLimit(mk(), {
      bucket: "vt",
      limit: 1,
      windowSec: 60,
    });
    const second = await enforceRateLimit(mk(), {
      bucket: "vt",
      limit: 1,
      windowSec: 60,
    });
    check("enforce allows the first request (null)", first === null);
    check(
      "enforce blocks the second with 429 + Retry-After",
      second !== null &&
        second.status === 429 &&
        second.headers.get("Retry-After") !== null,
    );

    // Configuration flag reflects Upstash env.
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    check("configured when Upstash env is present", isRateLimitConfigured());
  } finally {
    if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedTok === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = savedTok;
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
