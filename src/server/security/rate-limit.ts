// Pluggable rate limiter (build-now, keys-later).
//
// If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, enforcement is
// DISTRIBUTED (fixed window via Redis INCR/PEXPIRE over the REST API - no SDK,
// provider-neutral). Otherwise it falls back to a per-instance in-memory
// window, which is best-effort only (fine for dev / single instance; on
// serverless it does not coordinate across instances). Wire Upstash before
// launch for real protection - see the Go-Live Sign-off Register.

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetMs: number; // epoch ms when the window resets
}

export function isRateLimitConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

// --- In-memory fallback ------------------------------------------------------
const memory = new Map<string, { count: number; resetMs: number }>();

function memoryHit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  const entry = memory.get(key);
  if (!entry || entry.resetMs <= now) {
    const resetMs = now + windowMs;
    memory.set(key, { count: 1, resetMs });
    return { ok: true, limit, remaining: limit - 1, resetMs };
  }
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  return { ok: entry.count <= limit, limit, remaining, resetMs: entry.resetMs };
}

// Opportunistic sweep so the Map can't grow unbounded on a long-lived instance.
function sweep(now: number) {
  if (memory.size < 5000) return;
  for (const [k, v] of memory) if (v.resetMs <= now) memory.delete(k);
}

// --- Upstash (distributed) ---------------------------------------------------
async function upstashHit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rl:${key}`;
  // INCR then set the TTL only when the key is new (NX), so the window is fixed
  // from the first hit. One pipelined round-trip.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, windowMs, "NX"],
    ]),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const parsed = (await res.json()) as { result: number }[];
  const count = Number(parsed?.[0]?.result ?? 0);
  const remaining = Math.max(0, limit - count);
  return {
    ok: count <= limit,
    limit,
    remaining,
    resetMs: now + windowMs,
  };
}

/**
 * Count a hit against `key` and report whether it is within `limit` per
 * `windowSec`. Never throws - a limiter outage must not take the route down, so
 * a failed Upstash call fails OPEN (allows the request) and falls back to
 * in-memory. `now` is injectable for tests.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowMs = windowSec * 1000;
  sweep(now);
  if (isRateLimitConfigured()) {
    try {
      return await upstashHit(key, limit, windowMs, now);
    } catch {
      // Distributed store unreachable - degrade to in-memory rather than 500.
      return memoryHit(key, limit, windowMs, now);
    }
  }
  return memoryHit(key, limit, windowMs, now);
}

/** Best-effort client identifier from proxy headers (no PII stored). */
export function clientKey(req: Request, bucket: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  return `${bucket}:${ip}`;
}

/**
 * Guard a Route Handler. Returns a 429 `Response` when the caller is over the
 * limit, or `null` to proceed. Usage:
 *   const limited = await enforceRateLimit(req, { bucket: "invite", limit: 10, windowSec: 60 });
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: Request,
  opts: { bucket: string; limit: number; windowSec: number; key?: string },
): Promise<Response | null> {
  const key = opts.key ?? clientKey(req, opts.bucket);
  const r = await checkRateLimit(key, opts.limit, opts.windowSec);
  if (r.ok) return null;
  const retryAfter = Math.max(1, Math.ceil((r.resetMs - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(r.limit),
        "X-RateLimit-Remaining": String(r.remaining),
      },
    },
  );
}
