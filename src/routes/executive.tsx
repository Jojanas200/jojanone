import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  updateDecisionStatus,
  addReport,
} from "@/data/store";
import { computeSnapshot, formatRelative } from "@/data/selectors";
import { deriveAreaScores } from "@/data/cg-selectors";
import { investorReadinessMetrics, tenderReadinessMetrics } from "@/data/growth-selectors";
import { MODULES } from "@/config/modules.config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/core/MetricCard";
import { StatusPill, areaStatusTone } from "@/components/core/StatusPill";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { EmptyState } from "@/components/core/EmptyState";
import { ReportPreviewModal } from "@/components/core/ReportPreviewModal";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  FileBarChart,
  ShieldCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Decision } from "@/data/types";

export const Route = createFileRoute("/executive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Executive - Jojan One" },
      { name: "description", content: "A leadership-level view of business health." },
    ],
  }),
  component: ExecutivePage,
});

function ExecutivePage() {
  const state = useCoreData((s) => s);
  const navigate = useNavigate();
  const snapshot = useMemo(() => computeSnapshot(state), [state]);
  const derived = useMemo(() => deriveAreaScores(state), [state]);
  const investor = useMemo(() => investorReadinessMetrics(state), [state]);
  const tender = useMemo(() => tenderReadinessMetrics(state), [state]);
  const areas = state.areas.map((a) => {
    if (a.key === "compliance") {
      const s = derived.complianceScore;
      return { ...a, score: s, status: (s >= 80 ? "good" : s >= 65 ? "attention" : "risk") as typeof a.status, top_concern: derived.om.overdue[0]?.title ?? derived.om.actionRequired[0]?.title ?? a.top_concern, summary: `${derived.om.actionRequired.length} action(s) required, ${derived.om.overdue.length} overdue.` };
    }
    if (a.key === "gdpr") {
      const s = derived.gdprScore;
      return { ...a, score: s, status: (s >= 80 ? "good" : s >= 65 ? "attention" : "risk") as typeof a.status, top_concern: derived.gm.gaps[0] ?? a.top_concern, summary: `${derived.gm.gaps.length} gap(s); ${derived.gm.openRequests.length} open request(s).` };
    }
    if (a.key === "governance") {
      const s = derived.governanceScore;
      return { ...a, score: s, status: (s >= 80 ? "good" : s >= 65 ? "attention" : "risk") as typeof a.status, top_concern: derived.govm.minutesPending[0]?.title ?? derived.govm.pending[0]?.title ?? a.top_concern, summary: `${derived.govm.pending.length} pending; ${derived.govm.minutesPending.length} minutes to sign.` };
    }
    if (a.key === "risk") {
      const s = derived.riskScore;
      return { ...a, score: s, status: (s >= 80 ? "good" : s >= 65 ? "attention" : "risk") as typeof a.status, top_concern: derived.rm.highResidual[0]?.risk_title ?? a.top_concern, summary: `${derived.rm.open.length} open risks; ${derived.rm.highResidual.length} high residual.` };
    }
    return a;
  });
  const [period, setPeriod] = useState("q_current");
  const [decisionOpen, setDecisionOpen] = useState<Decision | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = state.reports.find((r) => r.id === previewId) ?? null;

  const generateExecReport = () => {
    setGenerating(true);
    setTimeout(() => {
      const id = addReport({
        report_type: "executive_summary",
        title: `Executive Report - ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
        reporting_period: "Last 90 days",
        summary: `Overall position ${snapshot.status_label} (${snapshot.score}/100). ${snapshot.open_priorities} open priorities, ${snapshot.overdue_actions} overdue.`,
        metrics: [
          { label: "Confidence Score", value: `${snapshot.score}/100` },
          { label: "Open priorities", value: String(snapshot.open_priorities) },
          { label: "Overdue", value: String(snapshot.overdue_actions) },
          { label: "Completed this month", value: String(snapshot.completed_this_month) },
          { label: "High risks", value: String(snapshot.high_priority_risks) },
        ],
        findings: state.activities.filter((a) => a.priority === "high").map((a) => a.title),
        priority_actions: state.activities
          .filter((a) => a.priority === "high" && a.status !== "completed")
          .map((a) => a.title),
        sections: [
          { heading: "Overall position", body: snapshot.explanation },
          ...areas.map((a) => ({ heading: a.label, body: a.summary, bullets: [a.top_concern] })),
          {
            heading: "Decisions required",
            body: `${state.decisions.filter((d) => d.status === "pending").length} pending decision(s).`,
            bullets: state.decisions.filter((d) => d.status === "pending").map((d) => d.title),
          },
        ],
        source_modules: ["compliance", "risk", "hr", "governance", "contracts", "gdpr"],
      });
      setGenerating(false);
      setPreviewId(id);
      toast.success("Executive report generated");
    }, 700);
  };

  const majorDevs = state.activities
    .filter((a) => a.completed_at && new Date(a.completed_at).getTime() > Date.now() - 30 * 86400000)
    .slice(0, 3);
  const concerns = state.activities.filter((a) => a.priority === "high" && a.status !== "completed");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      {/* Editorial hero */}
      <section className="hero-editorial px-6 py-8 md:px-10 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" />
              <span>Executive briefing</span>
              <span className="mx-1 text-border">·</span>
              <span className="normal-case tracking-normal">Updated {formatRelative(snapshot.last_updated)}</span>
            </div>
            <h1 className="font-display mt-4 text-[36px] leading-[1.08] text-foreground md:text-[48px]">
              The CEO briefing for {state.business.name}.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">
              A leadership-level view of your business position\u00a0 confidence,
              priorities, risk and readiness\u00a0 drawn from the latest recorded
              activity across every module.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="q_current">Current quarter</SelectItem>
                <SelectItem value="q_previous">Previous quarter</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generateExecReport} disabled={generating}>
              <FileBarChart className="mr-1.5 h-4 w-4" />
              {generating ? "Generating…" : "Generate Executive Report"}
            </Button>
          </div>
        </div>
        {/* Prepared by Jova - derived only from existing shared state */}
        <div className="mt-8 grid gap-3 rounded-lg border border-border/70 bg-card/80 p-4 backdrop-blur-sm sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-2 sm:pr-4 sm:border-r sm:border-border/70">
            <span className="jova-orb" aria-hidden="true" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Prepared by Jova
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground">
            Overall position is <strong>{snapshot.status_label.toLowerCase()}</strong> at{" "}
            {snapshot.score}/100.{" "}
            {snapshot.overdue_actions > 0
              ? `${snapshot.overdue_actions} item${snapshot.overdue_actions === 1 ? "" : "s"} overdue and `
              : ""}
            {snapshot.open_priorities} open priorit
            {snapshot.open_priorities === 1 ? "y" : "ies"};{" "}
            {state.decisions.filter((d) => d.status === "pending").length} decision
            {state.decisions.filter((d) => d.status === "pending").length === 1 ? "" : "s"} awaiting review.{" "}
            {snapshot.completed_this_month} activit
            {snapshot.completed_this_month === 1 ? "y" : "ies"} completed this month.
          </p>
        </div>
      </section>

      {/* Management summary */}
      <Card className="mt-8 border border-border bg-card p-6 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-primary">Management summary</span>
          <StatusPill tone={snapshot.status_label === "Good" ? "success" : snapshot.status_label === "Needs Attention" ? "warning" : "danger"}>
            {snapshot.status_label}
          </StatusPill>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-foreground">
          Overall position is <strong>{snapshot.status_label.toLowerCase()}</strong> with a Business Confidence Score of {snapshot.score}. {snapshot.explanation}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SummaryBlock title="Major developments" items={majorDevs.map((a) => a.title)} empty="No material developments in the last 30 days." />
          <SummaryBlock title="Key concerns" items={concerns.map((a) => a.title)} empty="No high-priority concerns outstanding." />
          <SummaryBlock
            title="Decisions required"
            items={state.decisions.filter((d) => d.status === "pending").map((d) => d.title)}
            empty="No decisions pending."
          />
          <SummaryBlock
            title="Positive progress"
            items={state.activities
              .filter((a) => a.status === "completed")
              .slice(0, 3)
              .map((a) => a.title)}
            empty="No completed activity yet."
          />
        </div>
      </Card>

      {/* Metrics */}
      <div className="mt-8">
        <h2 className="text-[16px] font-semibold text-foreground">Executive metrics</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Confidence Score" value={`${snapshot.score}/100`} />
          <MetricCard label="Open priorities" value={snapshot.open_priorities} icon={AlertTriangle} />
          <MetricCard label="High risks" value={snapshot.high_priority_risks} icon={ShieldCheck} />
          <MetricCard label="Overdue" value={snapshot.overdue_actions} icon={Clock} tone={snapshot.overdue_actions > 0 ? "danger" : "default"} />
          <MetricCard label="Completed" value={snapshot.completed_this_month} icon={CheckCircle2} tone="success" />
          <MetricCard label="Compliance" value={snapshot.compliance_position} icon={ShieldCheck} />
        </div>
      </div>

      {/* Growth */}
      <div className="mt-8">
        <h2 className="text-[16px] font-semibold text-foreground">Growth readiness</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Investor readiness" value={`${investor.overallScore}/100`} hint={`${investor.missing} missing · ${investor.highPriorityGaps.length} high-priority gaps`} onClick={() => navigate({ to: "/investor-ready" })} />
          <MetricCard label="Data room" value={`${investor.dataRoomComplete}%`} hint={`${investor.dataRoomReady} of ${investor.dataRoomTotal} ready`} onClick={() => navigate({ to: "/investor-ready" })} />
          <MetricCard label="Tender readiness" value={`${tender.readinessScore}/100`} hint={`${tender.active.length} active bid(s)`} onClick={() => navigate({ to: "/tender-ready" })} />
          <MetricCard label="Tender deadlines ≤30d" value={tender.upcomingDeadlines.length} tone={tender.upcomingDeadlines.length > 0 ? "warning" : "default"} icon={AlertTriangle} onClick={() => navigate({ to: "/tender-ready" })} />
        </div>
      </div>

      {/* Area cards */}
      <div className="mt-8">
        <h2 className="text-[16px] font-semibold text-foreground">Business areas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {areas.map((area) => {
            const mod = MODULES.find((m) => m.key === area.module)!;
            const Icon = mod.icon;
            return (
              <Card key={area.key} className="flex flex-col gap-3 border border-border bg-card p-5 shadow-none">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">{area.label}</p>
                  </div>
                  <StatusPill tone={areaStatusTone(area.status)}>{area.status}</StatusPill>
                </div>
                <div>
                  <div className="text-[24px] font-semibold text-foreground">{area.score}<span className="text-[14px] text-muted-foreground">/100</span></div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{area.summary}</p>
                </div>
                <p className="rounded-md bg-[oklch(0.98_0.003_260)] px-3 py-2 text-[12px] text-foreground">
                  <span className="font-semibold">Top concern: </span>
                  {area.top_concern}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-auto justify-start p-0 text-primary">
                  <Link to={mod.route}>
                    View {mod.title} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Decisions */}
      <div className="mt-8">
        <h2 className="text-[16px] font-semibold text-foreground">Decisions required</h2>
        <div className="mt-3 space-y-2">
          {state.decisions.length === 0 ? (
            <EmptyState title="No decisions pending" />
          ) : (
            state.decisions.map((d) => (
              <Card key={d.id} className="flex flex-wrap items-center gap-3 border border-border bg-card p-4 shadow-none">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground">{d.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{d.reason}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill tone={d.risk_level === "high" ? "danger" : d.risk_level === "medium" ? "warning" : "info"}>
                      {d.risk_level} risk
                    </StatusPill>
                    <StatusPill tone={d.status === "pending" ? "neutral" : "success"}>{d.status}</StatusPill>
                    <span className="text-[12px] text-muted-foreground">due {formatRelative(d.deadline)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setDecisionOpen(d)}>
                  Review
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>

      <DetailDrawer
        open={!!decisionOpen}
        onOpenChange={(v) => !v && setDecisionOpen(null)}
        title={decisionOpen?.title ?? ""}
      >
        {decisionOpen && (
          <div className="space-y-4">
            <p className="text-[14px] text-foreground">{decisionOpen.reason}</p>
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-[oklch(0.98_0.003_260)] p-4 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Risk level</dt>
                <dd className="mt-0.5 font-medium capitalize">{decisionOpen.risk_level}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deadline</dt>
                <dd className="mt-0.5 font-medium">{formatRelative(decisionOpen.deadline)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-0.5 font-medium capitalize">{decisionOpen.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Module</dt>
                <dd className="mt-0.5 font-medium">{MODULES.find((m) => m.key === decisionOpen.module)?.title}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  updateDecisionStatus(decisionOpen.id, "approved");
                  toast.success("Decision approved");
                  setDecisionOpen(null);
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateDecisionStatus(decisionOpen.id, "deferred");
                  toast.success("Decision deferred");
                  setDecisionOpen(null);
                }}
              >
                Defer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  updateDecisionStatus(decisionOpen.id, "reviewed");
                  toast.success("Marked reviewed");
                  setDecisionOpen(null);
                }}
              >
                Mark reviewed
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>

      <ReportPreviewModal report={preview} open={!!preview} onOpenChange={(v) => !v && setPreviewId(null)} />
    </div>
  );
}

function SummaryBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-[13px] text-foreground">
          {items.slice(0, 3).map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}