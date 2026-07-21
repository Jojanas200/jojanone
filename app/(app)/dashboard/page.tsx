import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { getOnboardingStatus } from "@/server/services/onboarding";
import { FinishSetupBanner } from "../FinishSetupBanner";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  await requireModuleAccess(claims, "dashboard");
  const [s, setup] = await Promise.all([
    getSnapshot(claims),
    getOnboardingStatus(claims),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Your business, at a glance.
      </p>

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
            </div>
            <div className="mt-2">
              <Badge variant={statusBadge(s.statusLabel)}>
                {s.statusLabel}
              </Badge>
            </div>
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

      {/* Headline metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
        <Tile label="People gaps" value={s.metrics.peopleGaps} tone />
        <Tile
          label="Expiring contracts"
          value={s.metrics.expiringContracts}
          tone
        />
      </div>

      {/* Priority actions */}
      {s.priorities.length > 0 && (
        <Card className="mb-6 p-0">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Priority actions
            </h2>
          </div>
          <ul className="divide-y divide-border/60">
            {s.priorities.map((p, i) => (
              <li key={i}>
                <Link
                  href={p.href}
                  className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-muted/40"
                >
                  <span className="text-foreground">{p.label}</span>
                  <span className="text-muted-foreground">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Module quick links */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">Modules</h2>
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
