import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims, getSessionUser } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { getScoreTrend } from "@/server/services/score-history";
import { getJovaBriefing } from "@/server/services/jova";
import { listActivities } from "@/server/services/activity";
import { getTimeline } from "@/server/services/timeline";
import { listReports } from "@/server/services/reports";
import { getBusinessProfile } from "@/server/services/settings";
import {
  getOnboarding,
  getOnboardingStatus,
} from "@/server/services/onboarding";
import { FinishSetupBanner } from "../FinishSetupBanner";
import { DashboardGreeting } from "./DashboardGreeting";
import { RefreshBriefing } from "./RefreshBriefing";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// A friendly first name for the greeting, sourced from the onboarding owner
// answer, falling back to the business name, then the email, then "there".
function firstNameFrom(
  ownerName: unknown,
  businessName: string | undefined,
  email: string | null | undefined,
): string {
  const owner = typeof ownerName === "string" ? ownerName.trim() : "";
  if (owner) return owner.split(/\s+/)[0];
  if (businessName?.trim()) return businessName.trim();
  const local = email?.split("@")[0];
  return local || "there";
}

// Plain-language explanation of why the score sits where it does (honest - no
// fabricated delta; production has no score history yet).
function scoreExplanation(m: {
  overdueObligations: number;
  actionRequired: number;
  criticalHighRisks: number;
}): string {
  if (m.overdueObligations > 0)
    return `${m.overdueObligations} overdue item${m.overdueObligations === 1 ? "" : "s"} ${m.overdueObligations === 1 ? "is" : "are"} holding your score below its ceiling - clearing ${m.overdueObligations === 1 ? "it" : "them"} would move you back up.`;
  if (m.criticalHighRisks > 0)
    return `${m.criticalHighRisks} high or critical risk${m.criticalHighRisks === 1 ? "" : "s"} ${m.criticalHighRisks === 1 ? "is" : "are"} weighing on your score.`;
  if (m.actionRequired > 0)
    return `${m.actionRequired} item${m.actionRequired === 1 ? "" : "s"} need your action to lift the score.`;
  return "Nothing is dragging your score down right now - you're in good standing.";
}

const isThisWeek = (d: Date) => Date.now() - new Date(d).getTime() < 7 * 864e5;
const isThisMonth = (d: Date) =>
  Date.now() - new Date(d).getTime() < 30 * 864e5;

const relativeTime = (d: Date): string => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
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

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p
        className={`text-2xl font-semibold ${tone && value > 0 ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { workspaceId } = await requireModuleAccess(claims, "dashboard");

  const [
    s,
    setup,
    briefing,
    activities,
    profile,
    onboarding,
    user,
    upcoming,
    reports,
  ] = await Promise.all([
    getSnapshot(claims),
    getOnboardingStatus(claims),
    getJovaBriefing(claims),
    listActivities(claims, 8),
    getBusinessProfile(claims, workspaceId),
    getOnboarding(claims, workspaceId),
    getSessionUser(),
    getTimeline(claims),
    listReports(claims),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const upcoming30 = upcoming.filter(
    (e) => e.date >= today && e.date <= in30,
  ).length;

  const trend = await getScoreTrend(
    claims,
    workspaceId,
    s.score,
    s.statusLabel,
  );

  const firstName = firstNameFrom(
    onboarding.answers["owner.full_name"],
    profile?.businessName,
    user?.email,
  );

  // Jova morning brief - four honest, data-derived lines.
  const changedThisWeek = activities.filter((a) => isThisWeek(a.createdAt));
  const thisMonth = activities.filter((a) => isThisMonth(a.createdAt));
  const monthModules = new Set(thisMonth.map((a) => a.module)).size;
  const topFinding = briefing.findings[0];
  const openPriorities = s.priorities.length;
  const brief = {
    changed: `${changedThisWeek.length} update${changedThisWeek.length === 1 ? "" : "s"} recorded this week.`,
    attention: `${s.metrics.overdueObligations} overdue and ${openPriorities} open priorit${openPriorities === 1 ? "y" : "ies"}.`,
    goingWell:
      thisMonth.length > 0
        ? `${thisMonth.length} update${thisMonth.length === 1 ? "" : "s"} this month across ${monthModules} module${monthModules === 1 ? "" : "s"}.`
        : "A calm month so far - nothing overdue slipping through.",
    next: topFinding
      ? `${topFinding.title} - ${topFinding.action}`
      : (s.priorities[0]?.label ?? "You're all caught up."),
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <DashboardGreeting name={firstName} />

      {setup.started && !setup.completed && (
        <FinishSetupBanner missing={setup.missing} />
      )}

      {/* Business Confidence Score */}
      <Card className="mb-6 p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,220px)_1fr] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Business Confidence Score
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span
                className={`text-5xl font-bold tabular-nums ${scoreTone(s.score)}`}
              >
                {s.score}
              </span>
              <span className="mb-1 text-lg text-muted-foreground">/100</span>
              {trend.delta !== null && trend.delta !== 0 && (
                <span
                  className={`mb-1.5 text-sm font-medium ${trend.delta > 0 ? "text-emerald-600" : "text-destructive"}`}
                  title={trend.since ? `since ${trend.since}` : undefined}
                >
                  {trend.delta > 0 ? "▲" : "▼"} {Math.abs(trend.delta)} pts
                </span>
              )}
            </div>
            <div className="mt-2">
              <Badge variant={statusBadge(s.statusLabel)}>
                {s.statusLabel}
              </Badge>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {scoreExplanation(s.metrics)}
            </p>
          </div>

          <div className="space-y-2.5">
            {s.areas.map((a) => (
              <Link key={a.key} href={a.href} className="block">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-muted-foreground">
                    {a.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${barTone(a.score)}`}
                      style={{ width: `${a.score}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-foreground">
                    {a.score}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {/* Jova morning brief */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Jova morning brief
          </p>
          <div className="flex items-center gap-3 text-sm">
            <RefreshBriefing />
            <Link href="/jova" className="text-primary hover:underline">
              Ask Jova
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "What changed", value: brief.changed },
            { label: "What needs attention", value: brief.attention },
            { label: "What's going well", value: brief.goingWell },
            { label: "Recommended next", value: brief.next },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </p>
              <p className="mt-1 text-sm text-foreground">{c.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Business overview */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Business overview
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Tile label="Open priorities" value={openPriorities} tone />
        <Tile
          label="Overdue obligations"
          value={s.metrics.overdueObligations}
          tone
        />
        <Tile label="Action required" value={s.metrics.actionRequired} tone />
        <Tile label="Open risks" value={s.metrics.openRisks} />
        <Tile
          label="Critical/high risks"
          value={s.metrics.criticalHighRisks}
          tone
        />
        <Tile
          label="Expiring contracts"
          value={s.metrics.expiringContracts}
          tone
        />
        <Tile label="Upcoming (30d)" value={upcoming30} />
        <Link href="/reports" className="block">
          <Tile label="Reports" value={reports.length} />
        </Link>
      </div>

      {/* Today's priorities */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Today&apos;s priorities
      </h2>
      {s.priorities.length === 0 ? (
        <Card className="mb-6 p-6">
          <p className="text-sm text-muted-foreground">
            Nothing needs your attention right now. New priorities across your
            modules will appear here.
          </p>
        </Card>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {s.priorities.map((p, i) => (
            <Card key={i} className="flex flex-col justify-between gap-3 p-4">
              <p className="text-sm font-medium text-foreground">{p.label}</p>
              <div className="flex items-center gap-3 text-xs">
                <Link
                  href={p.href}
                  className="font-medium text-primary hover:underline"
                >
                  Open
                </Link>
                <Link
                  href={`/jova?q=${encodeURIComponent(`Help me deal with this priority: ${p.label}. What should I do first?`)}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Ask Jova
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {activities.length > 0 && (
        <Card className="mb-6 p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Recent activity
            </h2>
            <Link
              href="/timeline"
              className="text-xs text-primary hover:underline"
            >
              View full timeline
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="text-foreground">{a.title}</span>
                  {a.description ? (
                    <span className="ml-2 text-muted-foreground">
                      {a.description}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {a.module}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(a.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Module quick links */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Quick Navigation
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/contracts",
            title: "Contracts",
            desc: "Register, track renewals and flag risk.",
          },
          {
            href: "/compliance",
            title: "Compliance",
            desc: "Every obligation, tracked with deadlines.",
          },
          {
            href: "/risk",
            title: "Risk",
            desc: "Inherent and residual scoring.",
          },
          {
            href: "/hr",
            title: "HR",
            desc: "Right-to-work, training and reviews.",
          },
          {
            href: "/gdpr",
            title: "GDPR",
            desc: "Your record of processing activities.",
          },
          {
            href: "/governance",
            title: "Governance",
            desc: "Decisions, resolutions and minutes.",
          },
          {
            href: "/investor-ready",
            title: "Investor Ready",
            desc: "Due-diligence checklist and data room.",
          },
          {
            href: "/tender-ready",
            title: "Tender Ready",
            desc: "Opportunities, deadlines and bid decisions.",
          },
        ].map((m) => (
          <Link key={m.href} href={m.href} className="block">
            <Card className="h-full transition hover:border-ring">
              <CardHeader>
                <CardTitle>{m.title}</CardTitle>
                <CardDescription>{m.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
