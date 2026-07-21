// Pluggable Redis cache (build-now, keys-later).
//
// Configuration is auto-detected from either naming convention; whichever set
// of variables is present wins (REST is preferred as it is serverless-native):
//
//   REST (Upstash / Vercel KV, HTTP - no persistent connection):
//     KV_REST_API_URL      + KV_REST_API_TOKEN         (Vercel)
//     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash / generic)
//
//   TCP (self-hosted or managed redis://, via ioredis):
//     REDIS_URL   (regular convention)
//     KV_URL      (Vercel TCP)
//
// With nothing configured the cache is a no-op: get() misses, set() is a
// swallow, and getOrSet() simply runs the loader every time - so the app works
// unchanged until credentials are added. Every operation is best-effort and
// NEVER throws; a cache outage must not take a request down.

const KEY_PREFIX = "jj:";

export type CacheKind = "rest" | "tcp" | "noop";

export interface CacheConfig {
  kind: CacheKind;
  restUrl?: string;
  restToken?: string;
  tcpUrl?: string;
}

/** Detect the active backend from the environment (reads fresh each call). */
export function cacheConfig(): CacheConfig {
  const restUrl =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const restToken =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) return { kind: "rest", restUrl, restToken };

  const tcpUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (tcpUrl) return { kind: "tcp", tcpUrl };

  return { kind: "noop" };
}

export function isCacheConfigured(): boolean {
  return cacheConfig().kind !== "noop";
}

// --- Backends ----------------------------------------------------------------
// A backend deals only in raw string values + TTL seconds; (de)serialisation
// and error-swallowing live in the Cache wrapper.
export interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
}

class NoopBackend implements CacheBackend {
  async get() {
    return null;
  }
  async set() {}
  async del() {}
}

// Upstash REST protocol (also spoken by Vercel KV). One HTTP round-trip per op.
class RestBackend implements CacheBackend {
  constructor(
    private url: string,
    private token: string,
  ) {}
  private async cmd(command: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`redis rest ${res.status}`);
    const data = (await res.json()) as { result?: unknown };
    return data.result ?? null;
  }
  async get(key: string) {
    const r = await this.cmd(["GET", key]);
    return typeof r === "string" ? r : null;
  }
  async set(key: string, value: string, ttlSec: number) {
    await this.cmd(["SET", key, value, "EX", ttlSec]);
  }
  async del(key: string) {
    await this.cmd(["DEL", key]);
  }
}

// TCP via ioredis. Imported lazily + kept as a singleton so the driver never
// loads (and never opens a socket) unless a TCP URL is configured.
class TcpBackend implements CacheBackend {
  private clientP: Promise<import("ioredis").Redis> | null = null;
  constructor(private url: string) {}
  private client() {
    if (!this.clientP) {
      this.clientP = import("ioredis").then(({ default: Redis }) => {
        const c = new Redis(this.url, {
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
          connectTimeout: 5000,
          lazyConnect: false,
        });
        c.on("error", () => {
          // Swallow connection errors; ops fall back via the Cache wrapper.
        });
        return c;
      });
    }
    return this.clientP;
  }
  async get(key: string) {
    return (await this.client()).get(key);
  }
  async set(key: string, value: string, ttlSec: number) {
    await (await this.client()).set(key, value, "EX", ttlSec);
  }
  async del(key: string) {
    await (await this.client()).del(key);
  }
}

function backendFor(cfg: CacheConfig): CacheBackend {
  if (cfg.kind === "rest") return new RestBackend(cfg.restUrl!, cfg.restToken!);
  if (cfg.kind === "tcp") return new TcpBackend(cfg.tcpUrl!);
  return new NoopBackend();
}

// --- Cache wrapper -----------------------------------------------------------
export class Cache {
  constructor(
    private backend: CacheBackend,
    readonly configured: boolean,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.backend.get(KEY_PREFIX + key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    try {
      await this.backend.set(KEY_PREFIX + key, JSON.stringify(value), ttlSec);
    } catch {
      // best-effort
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.backend.del(KEY_PREFIX + key);
    } catch {
      // best-effort
    }
  }

  /**
   * Return the cached value, or run `loader`, cache its result for `ttlSec`, and
   * return it. Cache failures degrade to just running the loader. Null/undefined
   * loader results are not cached (so a miss is retried next time).
   */
  async getOrSet<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const fresh = await loader();
    if (fresh !== null && fresh !== undefined)
      await this.set(key, fresh, ttlSec);
    return fresh;
  }
}

let singleton: Cache | null = null;

/** The process-wide cache (singleton). Backend chosen from the environment. */
export function getCache(): Cache {
  if (!singleton) {
    const cfg = cacheConfig();
    singleton = new Cache(backendFor(cfg), cfg.kind !== "noop");
  }
  return singleton;
}

/** Build a namespaced key from parts, e.g. cacheKey("analytics", wsId). */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}
