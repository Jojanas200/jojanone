import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  CalendarClock,
  ShieldCheck,
  FileBarChart,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/core/MetricCard";
import { PriorityActionCard } from "@/components/core/PriorityActionCard";
import { ActivityCard } from "@/components/core/ActivityCard";
import { ModuleLinkCard } from "@/components/core/ModuleLinkCard";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { ActivityDetail } from "@/components/core/ActivityDetail";
import { ScoreBreakdownDrawer } from "@/components/core/ScoreBreakdownDrawer";
import { StatusPill } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import {
  useCoreData,
  refreshBriefing,
  markActivityComplete,
  createConversation,
  appendMessage,
} from "@/data/store";
import { computeSnapshot, formatRelative, recentActivity, topPriorities } from "@/data/selectors";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard - Jojan One" },
      { name: "description", content: "Your business, at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const state = useCoreData((s) => s);
  const snapshot = useMemo(() => computeSnapshot(state), [state]);
  const priorities = useMemo(() => topPriorities(state, 4), [state]);
  const recent = useMemo(() => recentActivity(state, 6), [state]);
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [today, setToday] = useState<{ greeting: string; date: string } | null>(null);
  useEffect(() => {
    const d = new Date();
    const greeting =
      d.getHours() < 12 ? "Good morning" : d.getHours() < 18 ? "Good afternoon" : "Good evening";
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    setToday({ greeting, date: `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}` });
  }, []);
  const detail = state.activities.find((a) => a.id === detailId) ?? null;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      refreshBriefing();
      setRefreshing(false);
      toast.success("Briefing refreshed");
    }, 600);
  };

  const askJovaAbout = (question: string, ref?: { reference_type: string | null; reference_id: string | null }) => {
    const conv = createConversation(question);
    appendMessage({
      conversation_id: conv,
      sender: "user",
      content: question,
      reference_type: ref?.reference_type ?? null,
      reference_id: ref?.reference_id ?? null,
      suggested_action: null,
    });
    // Auto-response effect in JovaPage will generate and append Jova's reply.
    navigate({ to: "/jova", search: { c: conv } });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      {/* Editorial hero */}
      <section className="hero-editorial px-6 py-8 md:px-10 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <span className="jova-orb" aria-hidden="true" />
              <span>Jova is watching</span>
              <span className="mx-1 text-border">·</span>
              <span className="normal-case tracking-normal">{today?.date ?? "\u00A0"}</span>
            </div>
            <h1 className="font-display mt-4 text-[40px] leading-[1.05] text-foreground md:text-[56px]">
              {today?.greeting ?? "Welcome"}, {state.business.owner}.
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-foreground/85">
              {snapshot.overdue_actions > 0
                ? `You have ${snapshot.overdue_actions} overdue item${snapshot.overdue_actions === 1 ? "" : "s"} and ${snapshot.open_priorities} open priorit${snapshot.open_priorities === 1 ? "y" : "ies"}. Your Business Confidence Score sits at ${snapshot.score}\u00a0 needs attention.`
                : `You have ${snapshot.open_priorities} open priorit${snapshot.open_priorities === 1 ? "y" : "ies"}. Your Business Confidence Score sits at ${snapshot.score} - ${snapshot.status_label.toLowerCase()}.`}
            </p>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Latest recorded state · updated {formatRelative(snapshot.last_updated)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={"mr-1.5 h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
            Refresh briefing
          </Button>
        </div>
      </section>

      {/* Confidence Score + Morning Brief */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="col-span-1 flex flex-col justify-between border border-border bg-card p-6 shadow-none lg:col-span-1">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">Business Confidence Score</span>
              <StatusPill tone={snapshot.status_label === "Good" ? "success" : snapshot.status_label === "Needs Attention" ? "warning" : "danger"}>
                {snapshot.status_label}
              </StatusPill>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[52px] font-semibold leading-none text-foreground">{snapshot.score}</span>
              <span className="pb-2 text-[15px] text-muted-foreground">/ 100</span>
              <span className={"pb-2 text-[13px] font-medium " + (snapshot.change >= 0 ? "text-[oklch(0.5_0.15_148)]" : "text-destructive")}>
                {snapshot.change >= 0 ? "▲" : "▼"} {Math.abs(snapshot.change)} pts
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{snapshot.explanation}</p>
          </div>
          <Button variant="link" className="mt-4 h-auto justify-start p-0 text-primary" onClick={() => setScoreOpen(true)}>
            View breakdown <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Card>

        <Card className="lg:col-span-2 border border-border bg-card p-6 shadow-none">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-semibold uppercase tracking-wider text-primary">Jova Morning Brief</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BriefLine label="What changed" body={`${state.activities.filter((a) => a.completed_at && new Date(a.completed_at).getTime() > Date.now() - 7 * 86400000).length} activities completed this week.`} />
            <BriefLine
              label="What needs attention"
              body={
                snapshot.overdue_actions > 0
                  ? `${snapshot.overdue_actions} overdue and ${snapshot.open_priorities} open priorities.`
                  : `${snapshot.open_priorities} open priorities, none overdue.`
              }
            />
            <BriefLine label="What is going well" body={`${snapshot.completed_this_month} activities completed this month across ${new Set(state.activities.filter((a) => a.completed_at).map((a) => a.module)).size} modules.`} />
            <BriefLine
              label="Recommended next"
              body={priorities[0]?.title ?? "Nothing urgent - enjoy the calm."}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => askJovaAbout("Explain today's briefing")}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova about this
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/jova" })}>
              Open Jova <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Metrics */}
      <div className="mt-8">
        <h2 className="text-[16px] font-semibold text-foreground">Business overview</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Open priorities" value={snapshot.open_priorities} icon={AlertTriangle} tone={snapshot.open_priorities > 3 ? "warning" : "default"} />
          <MetricCard label="Overdue" value={snapshot.overdue_actions} icon={Clock} tone={snapshot.overdue_actions > 0 ? "danger" : "default"} />
          <MetricCard label="Upcoming (30d)" value={snapshot.upcoming_actions} icon={CalendarClock} />
          <MetricCard label="Active risks" value={snapshot.active_risks} icon={ShieldCheck} />
          <MetricCard label="Completed this month" value={snapshot.completed_this_month} icon={CheckCircle2} tone="success" />
          <MetricCard label="Recent reports" value={state.reports.length} icon={FileBarChart} onClick={() => navigate({ to: "/reports" })} />
        </div>
      </div>

      {/* Priorities + Recent activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">Today&apos;s priorities</h2>
            <span className="text-[12px] text-muted-foreground">{priorities.length} shown</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {priorities.length === 0 ? (
              <div className="sm:col-span-2">
                <EmptyState title="Nothing urgent" description="You have no open priorities right now." />
              </div>
            ) : (
              priorities.map((p) => (
                <PriorityActionCard
                  key={p.id}
                  activity={p}
                  onOpen={() => setDetailId(p.id)}
                  onAskJova={() => askJovaAbout(`Explain "${p.title}"`, { reference_type: "activity", reference_id: p.id })}
                  onComplete={() => {
                    markActivityComplete(p.id);
                    toast.success("Marked complete");
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">Recent activity</h2>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate({ to: "/timeline" })}>
              View full timeline
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {recent.map((a) => (
              <ActivityCard key={a.id} activity={a} onOpen={() => setDetailId(a.id)} compact />
            ))}
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="mt-10">
        <h2 className="text-[16px] font-semibold text-foreground">Quick navigation</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ModuleLinkCard moduleKey="executive" />
          <ModuleLinkCard moduleKey="timeline" />
          <ModuleLinkCard moduleKey="reports" />
          <ModuleLinkCard moduleKey="jova" />
        </div>
      </div>

      <ScoreBreakdownDrawer open={scoreOpen} onOpenChange={setScoreOpen} snapshot={snapshot} />
      <DetailDrawer
        open={!!detail}
        onOpenChange={(v) => !v && setDetailId(null)}
        title={detail?.title ?? ""}
      >
        {detail && (
          <ActivityDetail
            activity={detail}
            onClose={() => setDetailId(null)}
            onAskJova={() => {
              askJovaAbout(`Explain "${detail.title}"`, { reference_type: "activity", reference_id: detail.id });
              setDetailId(null);
            }}
            onComplete={() => {
              markActivityComplete(detail.id);
              toast.success("Marked complete");
              setDetailId(null);
            }}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

function BriefLine({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <HistoryIcon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground">{body}</p>
    </div>
  );
}