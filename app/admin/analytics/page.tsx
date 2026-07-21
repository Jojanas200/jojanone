import { Card } from "@/components/ui/card";
import {
  EMPTY_ANALYTICS,
  getPlatformAnalytics,
} from "@/server/services/platform-analytics";
import { EMPTY_USAGE, getUsageAnalytics } from "@/server/services/events";
import { getCache } from "@/server/cache/redis";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function AdminAnalyticsPage() {
  // Cached for 60s (Redis when configured, otherwise the loader runs directly).
  // Sequential + each guarded so a transient DB timeout renders zeros, not a 500.
  const cache = getCache();
  const a = await safe(
    () => cache.getOrSet("platform:analytics", 60, getPlatformAnalytics),
    EMPTY_ANALYTICS,
  );
  const usage = await safe(
    () => cache.getOrSet("platform:usage", 60, getUsageAnalytics),
    EMPTY_USAGE,
  );
  const maxEvents = Math.max(1, ...usage.eventsByDay.map((d) => d.count));

  const kpis: { label: string; value: string; sub?: string }[] = [
    {
      label: "Workspaces",
      value: String(a.workspaces.total),
      sub: `${a.workspaces.active} active · ${a.workspaces.suspended} suspended`,
    },
    {
      label: "Active MRR",
      value: money(a.mrrMinor),
      sub: `${money(a.arrMinor)} ARR`,
    },
    {
      label: "Seat utilisation",
      value: `${a.seats.utilizationPct}%`,
      sub: `${a.seats.used}/${a.seats.allowed} seats`,
    },
    {
      label: "New (30 days)",
      value: String(a.workspaces.new30),
      sub: "new workspaces",
    },
  ];

  const maxSignup = Math.max(1, ...a.signupsByDay.map((d) => d.count));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Growth, revenue and usage across every tenant.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{k.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground">
              {k.label}
            </p>
            {k.sub && (
              <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Signups trend (last 30 days) */}
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          New workspaces (last 30 days)
        </h2>
        {a.signupsByDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sign-ups in the last 30 days.
          </p>
        ) : (
          <div className="flex h-32 items-end gap-1">
            {a.signupsByDay.map((d) => (
              <div
                key={d.day}
                className="group relative flex-1"
                title={`${d.day}: ${d.count}`}
              >
                <div
                  className="rounded-t bg-foreground/80 transition group-hover:bg-foreground"
                  style={{
                    height: `${Math.max(4, (d.count / maxSignup) * 112)}px`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Peak {maxSignup} in a day · {a.workspaces.new30} total this period.
        </p>
      </Card>

      {/* Plan / status mix + AI usage */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            By plan
          </h2>
          <ul className="space-y-1 text-sm">
            {a.byPlan.map((r) => (
              <li key={r.key} className="flex justify-between">
                <span className="text-muted-foreground">{r.key}</span>
                <span className="tabular-nums text-foreground">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            By status
          </h2>
          <ul className="space-y-1 text-sm">
            {a.byStatus.map((r) => (
              <li key={r.key} className="flex justify-between">
                <span className="text-muted-foreground">
                  {r.key.replace(/_/g, " ")}
                </span>
                <span className="tabular-nums text-foreground">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Jova usage
          </h2>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Conversations</span>
              <span className="tabular-nums text-foreground">
                {a.ai.conversations}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Messages (all time)</span>
              <span className="tabular-nums text-foreground">
                {a.ai.messages}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Messages (30 days)</span>
              <span className="tabular-nums text-foreground">
                {a.ai.messages30}
              </span>
            </li>
          </ul>
        </Card>
      </div>

      {/* Product usage (from the event stream) */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">
          Product usage
        </h2>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "DAU", value: usage.activeUsers.dau, sub: "active today" },
            { label: "WAU", value: usage.activeUsers.wau, sub: "last 7 days" },
            { label: "MAU", value: usage.activeUsers.mau, sub: "last 30 days" },
            {
              label: "Returning (7d)",
              value: usage.returningUsers7d,
              sub: "active 2 weeks running",
            },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <p className="text-2xl font-semibold text-foreground">
                {k.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground">
                {k.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Events (last 30 days)
              </h3>
              <span className="text-xs text-muted-foreground">
                {usage.totalEvents30d} total · {usage.activeWorkspaces7d} active
                workspaces (7d)
              </span>
            </div>
            {usage.eventsByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events recorded yet. Usage is captured as tenants use the
                app.
              </p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {usage.eventsByDay.map((d) => (
                  <div
                    key={d.day}
                    className="flex-1"
                    title={`${d.day}: ${d.count}`}
                  >
                    <div
                      className="rounded-t bg-foreground/80 transition hover:bg-foreground"
                      style={{
                        height: `${Math.max(4, (d.count / maxEvents) * 112)}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Top actions (30d)
            </h3>
            {usage.topEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {usage.topEvents.map((e) => (
                  <li key={e.name} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {e.name}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {e.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
