import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getReport } from "@/server/services/reports";
import { getBusinessProfile } from "@/server/services/settings";
import { getCurrentLogo } from "@/server/services/documents";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "../PrintButton";

type Ctx = { params: Promise<{ id: string }> };

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function ReportDetailPage({ params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { workspaceId } = await requireModuleAccess(claims, "reports");

  const [report, profile, logo] = await Promise.all([
    getReport(claims, id),
    getBusinessProfile(claims, workspaceId),
    getCurrentLogo(claims),
  ]);
  if (!report) notFound();

  const metrics = (report.metrics as { label: string; value: string }[]) ?? [];
  const sections = (report.sections as { title: string; body: string }[]) ?? [];
  const businessName = profile?.businessName?.trim() || "Your business";
  const particulars = [
    profile?.companyNumber ? `Company no. ${profile.companyNumber}` : null,
    profile?.industry ?? null,
    profile?.registeredAddress ?? null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Reports
        </Link>
        <PrintButton />
      </div>

      <Card className="p-8">
        {/* Branded header: logo + business particulars */}
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {report.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {businessName}
              {report.reportingPeriod ? ` · ${report.reportingPeriod}` : ""}
            </p>
            {particulars.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {particulars.join(" · ")}
              </p>
            )}
          </div>
          {logo?.id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/branding/logo?v=${logo.id}`}
              alt={businessName}
              className="max-h-14 w-auto object-contain"
            />
          ) : null}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Badge
            variant={report.status === "final" ? "secondary" : "outline"}
            className="capitalize"
          >
            {report.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Generated {fmtDate(report.createdAt)}
          </span>
        </div>

        {report.summary && (
          <p className="mb-6 text-sm leading-relaxed text-foreground">
            {report.summary}
          </p>
        )}

        {metrics.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Key metrics
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metrics.map((m, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <p className="text-lg font-semibold text-foreground">
                    {m.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {sections.map((sec, i) => (
          <section key={i} className="mb-6">
            <h2 className="mb-1 text-sm font-semibold text-foreground">
              {sec.title}
            </h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {sec.body}
            </p>
          </section>
        ))}

        {report.findings.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Findings
            </h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {report.findings.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.priorityActions.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Priority actions
            </h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {report.priorityActions.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.sourceModules.length > 0 && (
          <p className="mt-8 text-xs text-muted-foreground">
            Sources: {report.sourceModules.join(" · ")}
          </p>
        )}

        <p className="mt-4 border-t border-border pt-4 text-[11px] text-muted-foreground">
          Generated by Jojan One from {businessName}&apos;s own records.
          Guidance based on your data, not professional advice.
        </p>
      </Card>
    </div>
  );
}
