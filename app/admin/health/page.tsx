import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSystemHealth } from "@/server/services/platform-health";

const statusBadge = (s: "ok" | "error" | "not_configured") =>
  s === "ok" ? (
    <Badge variant="secondary">Connected</Badge>
  ) : s === "error" ? (
    <Badge variant="destructive">Error</Badge>
  ) : (
    <Badge variant="outline">Not configured</Badge>
  );

export default async function AdminHealthPage() {
  const h = await getSystemHealth();
  const configured = h.integrations.filter((i) => i.status === "ok").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          System health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live database check and integration configuration. Presence only -
          secrets are never shown.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${h.healthy ? "bg-emerald-500" : "bg-red-500"}`}
            />
            <p className="text-lg font-semibold text-foreground">
              {h.healthy ? "Operational" : "Degraded"}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Overall status</p>
        </Card>
        <Card className="p-4">
          <div className="text-lg font-semibold text-foreground">
            {statusBadge(h.database)}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Database</p>
        </Card>
        <Card className="p-4">
          <p className="text-lg font-semibold text-foreground">
            {configured}/{h.integrations.length}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Integrations configured
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">
            Integrations
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {h.integrations.map((i) => (
            <li
              key={i.key}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{i.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {i.detail}
                </p>
              </div>
              <div className="shrink-0">{statusBadge(i.status)}</div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-4 text-[11px] text-muted-foreground">
        &quot;Not configured&quot; features degrade gracefully - the app keeps
        working and the feature turns on when its key is added.
      </p>
    </div>
  );
}
