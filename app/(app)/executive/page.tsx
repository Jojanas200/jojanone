import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { getScoreTrend } from "@/server/services/score-history";
import {
  getExecutiveTotals,
  getGrowthSignals,
  listPendingDecisions,
} from "@/server/services/executive";
import { getJovaBriefing } from "@/server/services/jova";
import { getBusinessProfile } from "@/server/services/settings";
import { listActivities } from "@/server/services/activity";
import { getReadinessAssessment } from "@/server/services/investor-readiness";
import { getTenderReadiness } from "@/server/services/tender-readiness";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WriteGate } from "../WriteGate";
import { GenerateExecutiveReport } from "./GenerateExecutiveReport";
import { DecisionList } from "./DecisionList";

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
const positionLabel = (n: number) =>
  n >= 80 ? "On track" : n >= 60 ? "Minor gaps" : "Needs attention";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);

export default async function ExecutivePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { workspaceId, access } = await requireModuleAccess(
    claims,
    "executive",
  );

  const [
    s,
    totals,
    activity,
    profile,
    briefing,
    decisions,
    growth,
    investorAssessment,
    tenderReadiness,
  ] = await Promise.all([
    getSnapshot(claims),
    getExecutiveTotals(claims),
    listActivities(claims, 5),
    getBusinessProfile(claims, workspaceId),
    getJovaBriefing(claims),
    listPendingDecisions(claims),
    getGrowthSignals(claims),
    getReadinessAssessment(claims),
    getTenderReadiness(claims),
  ]);
  const dataRoomPct =
    growth.ddTotal > 0
      ? Math.round((growth.ddReady / growth.ddTotal) * 100)
      : null;
  const trend = await getScoreTrend(
    claims,
    workspaceId,
    s.score,
    s.statusLabel,
  );

  const businessName = profile?.businessName?.trim() || "your business";
  const openPriorities = s.priorities.length;
  const complianceScore =
    s.areas.find((a) => a.key === "compliance")?.score ?? s.score;

  // "Prepared by Jova" position statement - composed from real metrics.
  const prepared = `Overall position is ${s.statusLabel.toLowerCase()} at ${s.score}/100. ${
    s.metrics.overdueObligations
  } item${s.metrics.overdueObligations === 1 ? "" : "s"} overdue and ${openPriorities} open priorit${
    openPriorities === 1 ? "y" : "ies"
  }; ${decisions.length} decision${decisions.length === 1 ? "" : "s"} awaiting review.`;

  const highFindings = briefing.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  const topAreas = [...s.areas].sort((a, b) => b.score - a.score);
  const topConcernFor = (key: string) =>
    briefing.findings.find((f) => f.module === key);

  const summary = [
    {
      label: "Major developments",
      items: activity.slice(0, 3).map((a) => a.title),
      empty: "No recent activity recorded.",
    },
    {
      label: "Key concerns",
      items: highFindings.slice(0, 3).map((f) => f.title),
      empty: "No high or critical concerns.",
    },
    {
      label: "Decisions required",
      items: decisions.slice(0, 3).map((d) => d.title),
      empty: "Nothing awaiting sign-off.",
    },
    {
      label: "Positive progress",
      items: topAreas
        .filter((a) => a.score >= 70)
        .slice(0, 3)
        .map((a) => `${a.label} - ${a.score}/100`),
      empty: "Building momentum across the board.",
    },
  ];

  const metrics = [
    { label: "Confidence Score", value: `${s.score}/100` },
    { label: "Open priorities", value: String(openPriorities) },
    {
      label: "High/critical risks",
      value: String(s.metrics.criticalHighRisks),
    },
    { label: "Overdue", value: String(s.metrics.overdueObligations) },
    { label: "Decisions to review", value: String(decisions.length) },
    { label: "Compliance", value: positionLabel(complianceScore) },
  ];

  const execReport = {
    title: `Executive Summary - ${businessName}`,
    summary: prepared,
    metrics,
    findings: briefing.findings
      .slice(0, 12)
      .map((f) => `[${f.severity}] ${f.title}`),
    priorityActions: s.priorities.map((p) => p.label),
    sourceModules: s.areas.map((a) => a.key),
  };

  const totalsTiles = [
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
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* CEO briefing header */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Executive briefing
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              The CEO briefing for {businessName}.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A leadership-level view of position, priorities, risk and
              readiness - drawn from live activity across every module.
            </p>
          </div>
          <Badge variant={statusBadge(s.statusLabel)}>{s.statusLabel}</Badge>
        </div>
        <WriteGate>
          <div className="mt-4">
            <GenerateExecutiveReport payload={execReport} />
          </div>
        </WriteGate>
      </div>

      {/* Prepared by Jova */}
      <Card className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Prepared by Jova
        </span>
        <span className="text-sm text-foreground">{prepared}</span>
      </Card>

      {/* Management summary */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Management summary
          </span>
          <Badge variant={statusBadge(s.statusLabel)}>{s.statusLabel}</Badge>
        </div>
        <p className="mt-2 text-sm text-foreground">
          Overall position is <strong>{s.statusLabel.toLowerCase()}</strong>{" "}
          with a Business Confidence Score of {s.score}.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {summary.map((b) => (
            <div key={b.label} className="rounded-lg bg-muted/40 p-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {b.label}
              </p>
              {b.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{b.empty}</p>
              ) : (
                <ul className="space-y-1 text-sm text-foreground">
                  {b.items.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span className="min-w-0">{it}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Executive metrics */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Executive metrics
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-lg font-semibold text-foreground">{m.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.label}</p>
          </Card>
        ))}
      </div>

      {/* Confidence score + area breakdown */}
      <Card className="mb-6 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="shrink-0 text-center sm:w-40">
            <p className={`text-5xl font-bold ${scoreTone(s.score)}`}>
              {s.score}
            </p>
            {trend.delta !== null && trend.delta !== 0 && (
              <p
                className={`text-xs font-medium ${trend.delta > 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {trend.delta > 0 ? "▲" : "▼"} {Math.abs(trend.delta)} pts
              </p>
            )}
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

      {/* Business areas - score + top concern */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Business areas
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {s.areas.map((a) => {
          const concern = topConcernFor(a.key);
          return (
            <Card key={a.key} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {a.label}
                </span>
                <span className={`text-lg font-bold ${scoreTone(a.score)}`}>
                  {a.score}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>
              <div className="mt-3 rounded-md bg-muted/50 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Top concern
                </p>
                <p className="text-xs text-foreground">
                  {concern ? concern.title : "No concerns flagged."}
                </p>
              </div>
              <Link
                href={a.href}
                className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
              >
                View {a.label} →
              </Link>
            </Card>
          );
        })}
      </div>

      {/* Growth readiness (honest signals) */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Growth readiness
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href="/investor-ready"
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20"
        >
          <p className="text-xl font-semibold text-foreground">
            {investorAssessment ? (
              <>
                {investorAssessment.overallScore}
                <span className="text-sm text-muted-foreground">/100</span>
              </>
            ) : (
              "-"
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Investor readiness
          </p>
        </Link>
        <Link
          href="/tender-ready"
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20"
        >
          <p className="text-xl font-semibold text-foreground">
            {tenderReadiness.readinessScore}
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tender readiness
          </p>
        </Link>
        <Link
          href="/investor-ready"
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20"
        >
          <p className="text-xl font-semibold text-foreground">
            {dataRoomPct === null ? "-" : `${dataRoomPct}%`}
            <span className="text-sm text-muted-foreground">
              {growth.ddTotal > 0
                ? ` (${growth.ddReady}/${growth.ddTotal})`
                : ""}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Due diligence ready
          </p>
        </Link>
        <Link
          href="/tender-ready"
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20"
        >
          <p className="text-xl font-semibold text-foreground">
            {growth.tenderActive}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Active tenders</p>
        </Link>
        <Link
          href="/tender-ready"
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20"
        >
          <p className="text-xl font-semibold text-foreground">
            {money(growth.tenderValueMinor)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Tender value</p>
        </Link>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p
            className={`text-xl font-semibold ${growth.tenderDeadlines30d > 0 ? "text-amber-600" : "text-foreground"}`}
          >
            {growth.tenderDeadlines30d}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tender deadlines ≤30d
          </p>
        </div>
      </div>

      {/* Decisions required */}
      <Card className="mb-6 p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Decisions required
          </h2>
        </div>
        {decisions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nothing awaiting sign-off. Governance records in draft or pending
            approval will appear here.
          </p>
        ) : (
          <DecisionList decisions={decisions} canWrite={access.canWrite} />
        )}
      </Card>

      {/* Cross-module totals */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {totalsTiles.map((st) => (
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
    </div>
  );
}
