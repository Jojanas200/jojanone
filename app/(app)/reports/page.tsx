import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import {
  listReports,
  REPORT_CATALOG,
  DATASETS,
  DATASET_KEYS,
} from "@/server/services/reports";
import { Card } from "@/components/ui/card";
import { GenerateCard } from "./GenerateCard";
import { ReportsLibrary, type LibraryReport } from "./ReportsLibrary";

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default async function ReportsPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "reports");
  const saved = await listReports(claims);

  const now = new Date();
  const thisMonth = saved.filter((r) => {
    const d = new Date(r.createdAt);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;
  const drafts = saved.filter((r) => r.status === "draft").length;

  const stats = [
    { label: "Total reports", value: String(saved.length) },
    { label: "Generated this month", value: String(thisMonth) },
    { label: "Drafts", value: String(drafts) },
    {
      label: "Most recent",
      value: saved[0] ? fmtDate(saved[0].createdAt) : "-",
    },
  ];

  const library: LibraryReport[] = saved.map((r) => ({
    id: r.id,
    reportType: r.reportType,
    title: r.title,
    reportingPeriod: r.reportingPeriod,
    status: r.status,
    summary: r.summary,
    createdAt: r.createdAt as unknown as string,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn your data into evidence for lenders, insurers and investors.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Generate a report */}
      {access.canWrite && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Generate a report
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_CATALOG.map((meta) => (
              <GenerateCard key={meta.key} meta={meta} />
            ))}
          </div>
        </section>
      )}

      {/* Reports library */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Reports library
        </h2>
        <ReportsLibrary reports={library} canWrite={access.canWrite} />
      </section>

      {/* Data exports (CSV) */}
      <section>
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
    </div>
  );
}
