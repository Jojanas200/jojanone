/**
 * Verifies the Redis cache layer (build-now, keys-later):
 *  - config auto-detects BOTH conventions (regular REDIS_URL + Vercel/Upstash
 *    REST), REST preferred, else no-op;
 *  - unconfigured => no-op: getOrSet runs the loader every time;
 *  - with a backend: getOrSet caches (loader runs once), get/set/del round-trip
 *    JSON, and a throwing backend degrades gracefully (never throws).
 *
 * No real Redis needed. Run: ./node_modules/.bin/tsx scripts/verify-cache.ts
 */
import {
  Cache,
  cacheConfig,
  cacheKey,
  getCache,
  isCacheConfigured,
  type CacheBackend,
} from "../src/server/cache/redis";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

// In-memory fake backend for exercising the cache logic without a server.
class FakeBackend implements CacheBackend {
  store = new Map<string, string>();
  gets = 0;
  sets = 0;
  async get(k: string) {
    this.gets++;
    return this.store.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.sets++;
    this.store.set(k, v);
  }
  async del(k: string) {
    this.store.delete(k);
  }
}

class ThrowingBackend implements CacheBackend {
  async get(): Promise<string | null> {
    throw new Error("down");
  }
  async set(): Promise<void> {
    throw new Error("down");
  }
  async del(): Promise<void> {
    throw new Error("down");
  }
}

async function main() {
  const saved = {
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    REDIS_URL: process.env.REDIS_URL,
    KV_URL: process.env.KV_URL,
  };
  const clearEnv = () => {
    for (const k of Object.keys(saved)) delete process.env[k];
  };

  try {
    // --- Config detection ----------------------------------------------------
    clearEnv();
    check("no env => not configured (noop)", isCacheConfigured() === false);
    check("noop kind reported", cacheConfig().kind === "noop");

    process.env.REDIS_URL = "redis://localhost:6379";
    check("REDIS_URL detected as tcp", cacheConfig().kind === "tcp");

    clearEnv();
    process.env.KV_URL = "redis://vercel:6379";
    check("KV_URL (Vercel TCP) detected as tcp", cacheConfig().kind === "tcp");

    clearEnv();
    process.env.UPSTASH_REDIS_REST_URL = "https://x.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    check("Upstash REST detected as rest", cacheConfig().kind === "rest");

    clearEnv();
    process.env.KV_REST_API_URL = "https://x.kv.vercel-storage.com";
    process.env.KV_REST_API_TOKEN = "tok";
    check("Vercel KV REST detected as rest", cacheConfig().kind === "rest");

    // REST preferred over TCP when both are present.
    process.env.REDIS_URL = "redis://localhost:6379";
    check(
      "REST preferred when both REST + TCP present",
      cacheConfig().kind === "rest",
    );
    clearEnv();

    // --- No-op behaviour (unconfigured) -------------------------------------
    const noop = getCache(); // built from cleared env => noop
    check("getCache() is unconfigured with no env", noop.configured === false);
    let calls = 0;
    const load = async () => {
      calls++;
      return { n: calls };
    };
    await noop.getOrSet("k", 60, load);
    await noop.getOrSet("k", 60, load);
    check("noop getOrSet runs the loader every time", calls === 2);
    check("noop get() always misses", (await noop.get("k")) === null);

    // --- Real cache logic via a fake backend --------------------------------
    const fake = new FakeBackend();
    const cache = new Cache(fake, true);
    await cache.set("obj", { hello: "world", n: 1 }, 60);
    const got = await cache.get<{ hello: string; n: number }>("obj");
    check(
      "set/get round-trips JSON with the jj: prefix",
      got?.hello === "world" &&
        got?.n === 1 &&
        [...fake.store.keys()].every((k) => k.startsWith("jj:")),
    );

    let loads = 0;
    const loader = async () => {
      loads++;
      return { v: 42 };
    };
    const a1 = await cache.getOrSet("gs", 60, loader);
    const a2 = await cache.getOrSet("gs", 60, loader);
    check(
      "getOrSet caches: loader runs once, both return the value",
      loads === 1 && a1.v === 42 && a2.v === 42,
    );

    await cache.del("gs");
    check("del removes the key", (await cache.get("gs")) === null);

    // --- Graceful degradation (backend throws) ------------------------------
    const brittle = new Cache(new ThrowingBackend(), true);
    let brittleLoads = 0;
    const r = await brittle.getOrSet("x", 60, async () => {
      brittleLoads++;
      return "ok";
    });
    check(
      "a throwing backend never breaks the request (loader still returns)",
      r === "ok" && brittleLoads === 1,
    );
    check(
      "get/set/del swallow backend errors",
      (await brittle.get("x")) === null,
    );

    check(
      "cacheKey joins parts",
      cacheKey("analytics", "ws1") === "analytics:ws1",
    );
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
