import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { getExecutiveTotals } from "@/server/services/executive";
import { listActivities } from "@/server/services/activity";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MODULE_LABEL: Record<string, string> = {
  contracts: "Contracts",
  compliance: "Compliance",
  risk: "Risk",
  hr: "HR",
  gdpr: "GDPR",
  governance: "Governance",
  "tender-ready": "Tender",
  "investor-ready": "Investor",
  academy: "Academy",
};

const relTime = (d: Date) => {
  const diff = Date.now() - new Date(d).getTime();
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  return `${Math.floor(diff / day)}d ago`;
};

const scoreTone = (n: number) =>
  n >= 80
    ? "text-emerald-600"
    : n >= 60
      ? "text-amber-600"
      : "text-destructive";
const barTone = (n: number) =>
  n >= 80 ? "bg-emerald-500" : n >= 60 ? "bg-amber-500" : "bg-destructive";
const statusBadge = (label: string) =>
  label === "Good"
    ? "secondary"
    : label === "Needs Attention"
      ? "outline"
      : "destructive";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);

export default async function ExecutivePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "executive");
  const [s, totals, activity] = await Promise.all([
    getSnapshot(claims),
    getExecutiveTotals(claims),
    listActivities(claims, 12),
  ]);

  const stats: { label: string; value: string; href: string }[] = [
    {
      label: "Active contracts",
      value: String(totals.activeContracts),
      href: "/contracts",
    },
    {
      label: "Active people",
      value: String(totals.activeEmployees),
      href: "/hr",
    },
    { label: "Open risks", value: String(totals.openRisks), href: "/risk" },
    {
      label: "Processing activities",
      value: String(totals.processingActivities),
      href: "/gdpr",
    },
    {
      label: "Governance records",
      value: String(totals.governanceRecords),
      href: "/governance",
    },
    {
      label: "Tender pipeline",
      value: `${totals.tenderPipeline} · ${money(totals.tenderPipelineValue)}`,
      href: "/tender-ready",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Executive
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A leadership-level view of business health.
          </p>
        </div>
        <Badge variant={statusBadge(s.statusLabel)}>{s.statusLabel}</Badge>
      </div>

      {/* Confidence score + area breakdown */}
      <Card className="mb-6 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="shrink-0 text-center sm:w-40">
            <p className={`text-5xl font-bold ${scoreTone(s.score)}`}>
              {s.score}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              Business Confidence
            </p>
          </div>
          <div className="flex-1 space-y-3">
            {s.areas.map((a) => (
              <div key={a.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <Link
                    href={a.href}
                    className="font-medium text-foreground hover:underline"
                  >
                    {a.label}
                  </Link>
                  <span className="text-muted-foreground">
                    {a.score} · {a.note}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${barTone(a.score)}`}
                    style={{ width: `${a.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Cross-module totals */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((st) => (
          <Link
            key={st.label}
            href={st.href}
            className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20"
          >
            <p className="text-xl font-semibold text-foreground">{st.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{st.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <Card className="mb-6 p-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity recorded yet. Actions across your modules will appear
            here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0"
              >
                <Badge variant="outline" className="shrink-0">
                  {MODULE_LABEL[a.module] ?? a.module}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {a.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.description}
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {relTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Top exposures */}
      <Card className="p-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Top exposures
        </h2>
        {s.priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No priority actions outstanding. The business is in good standing.
          </p>
        ) : (
          <ul className="space-y-2">
            {s.priorities.map((p, i) => (
              <li key={i}>
                <Link
                  href={p.href}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:bg-muted/50"
                >
                  <span>{p.label}</span>
                  <span className="text-xs text-muted-foreground">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
