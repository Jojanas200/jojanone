import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { isCacheConfigured } from "../cache/redis";

// System health + integration configuration for the platform admin. A live DB
// round-trip plus presence-only booleans for every optional integration (never
// the secret values). Shared by /api/health and the /admin/health page.

export type CheckStatus = "ok" | "error" | "not_configured";

export interface Integration {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface SystemHealth {
  database: CheckStatus;
  integrations: Integration[];
  healthy: boolean;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  let database: CheckStatus = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "error";
  }

  const bool = (present: unknown): CheckStatus =>
    present ? "ok" : "not_configured";

  const integrations: Integration[] = [
    {
      key: "stripe",
      label: "Stripe (billing)",
      status: bool(process.env.STRIPE_SECRET_KEY),
      detail: "Checkout, Customer Portal and subscriptions.",
    },
    {
      key: "stripe_webhook",
      label: "Stripe webhook",
      status: bool(process.env.STRIPE_WEBHOOK_SECRET),
      detail: "Signature-verified subscription events.",
    },
    {
      key: "ai",
      label: "AI provider (Jova)",
      status: bool(
        process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY,
      ),
      detail: "Live model calls; falls back to the deterministic engine.",
    },
    {
      key: "email",
      label: "Email (Resend)",
      status: bool(process.env.RESEND_API_KEY),
      detail: "Invites + reminder digests. Console-logs when unset.",
    },
    {
      key: "companies_house",
      label: "Companies House",
      status: bool(process.env.COMPANIES_HOUSE_API_KEY),
      detail: "Official company lookups. Serves stale cache when unset.",
    },
    {
      key: "cache",
      label: "Redis cache",
      status: isCacheConfigured() ? "ok" : "not_configured",
      detail: "Caches hot reads. No-op (loaders run directly) when unset.",
    },
    {
      key: "rate_limit",
      label: "Distributed rate limiting",
      status: bool(
        process.env.UPSTASH_REDIS_REST_URL &&
          process.env.UPSTASH_REDIS_REST_TOKEN,
      ),
      detail: "Cross-instance limits. In-memory best-effort when unset.",
    },
    {
      key: "cron",
      label: "Cron secret",
      status: bool(process.env.CRON_SECRET),
      detail: "Auth for the reminder/digest cron endpoints.",
    },
  ];

  return { database, integrations, healthy: database === "ok" };
}
