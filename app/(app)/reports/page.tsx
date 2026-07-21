import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { listReports, DATASETS, DATASET_KEYS } from "@/server/services/reports";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportToolbar, type SnapshotPayload } from "./ReportToolbar";
import { DeleteReport } from "./DeleteReport";

const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function ReportsPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "reports");
  const [s, saved] = await Promise.all([
    getSnapshot(claims),
    listReports(claims),
  ]);

  const metricTiles: { label: string; value: number }[] = [
    { label: "Overdue obligations", value: s.metrics.overdueObligations },
    { label: "Action required", value: s.metrics.actionRequired },
    { label: "Open risks", value: s.metrics.openRisks },
    { label: "Critical / high risks", value: s.metrics.criticalHighRisks },
    { label: "People gaps", value: s.metrics.peopleGaps },
    { label: "Contracts expiring", value: s.metrics.expiringContracts },
  ];

  const snapshotPayload: SnapshotPayload = {
    title: `Board pack - ${new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`,
    summary: `Business Confidence ${s.score}/100 (${s.statusLabel}).`,
    metrics: metricTiles,
    findings: s.priorities.map((p) => p.label),
    sourceModules: s.areas.map((a) => a.key),
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn your data into evidence for lenders, insurers and investors.
          </p>
        </div>
        <ReportToolbar snapshot={snapshotPayload} />
      </div>

      {/* Board pack (print target) */}
      <Card className="mb-8 p-6" id="board-pack">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Business confidence board pack
          </h2>
          <Badge
            variant={
              s.statusLabel === "Good"
                ? "secondary"
                : s.statusLabel === "Needs Attention"
                  ? "outline"
                  : "destructive"
            }
          >
            {s.statusLabel}
          </Badge>
        </div>

        <div className="mb-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-foreground">{s.score}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              of 100
            </p>
          </div>
          <div className="flex-1 space-y-2">
            {s.areas.map((a) => (
              <div key={a.key} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{a.label}</span>
                <span className="tabular-nums text-foreground">
                  {a.score} · {a.note}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metricTiles.map((m) => (
            <div key={m.label} className="rounded-lg border border-border p-3">
              <p className="text-xl font-semibold text-foreground">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Priority actions
          </h3>
          {s.priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outstanding priority actions.
            </p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {s.priorities.map((p, i) => (
                <li key={i}>{p.label}</li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">
          Generated {fmtDateTime(new Date())} from live workspace data.
        </p>
      </Card>

      {/* Data exports */}
      <section className="mb-8 print:hidden">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Data exports (CSV)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DATASET_KEYS.map((key) => (
            <a
              key={key}
              href={`/api/reports/export/${key}`}
              className="rounded-lg border border-border px-3 py-2.5 text-sm text-foreground transition hover:bg-muted/50"
            >
              {DATASETS[key].label}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Download .csv
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Saved snapshots */}
      <section className="print:hidden">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Saved snapshots
        </h2>
        {saved.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No saved snapshots yet. Use “Save snapshot” to keep a dated record
            of your board pack.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {saved.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {r.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.summary} · {fmtDateTime(r.createdAt)}
                  </p>
                </div>
                <DeleteReport id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
