import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listProcessingActivities } from "@/server/services/gdpr";
import { listObligations } from "@/server/services/compliance";
import {
  getGdprAssessment,
  listDataBreaches,
  listDataRequests,
  listDpias,
  listPrivacyNotices,
} from "@/server/services/gdpr-registers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProcessingActivity } from "./NewProcessingActivity";
import { GdprBoard } from "./GdprBoard";
import { DataRequestsBoard } from "./DataRequestsBoard";
import { DataBreachesBoard } from "./DataBreachesBoard";
import { DpiaBoard } from "./DpiaBoard";
import { PrivacyNoticesBoard } from "./PrivacyNoticesBoard";
import { GdprAssessmentPanel } from "./GdprAssessmentPanel";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GdprRecommendation } from "@/shared/schemas/gdpr-registers";

export default async function GdprPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "gdpr");
  const [
    activities,
    requests,
    breaches,
    dpiaRows,
    notices,
    assessment,
    obligations,
  ] = await Promise.all([
    listProcessingActivities(claims),
    listDataRequests(claims),
    listDataBreaches(claims),
    listDpias(claims),
    listPrivacyNotices(claims),
    getGdprAssessment(claims),
    listObligations(claims),
  ]);
  const canWrite = access.canWrite;

  // Page-level position, mirrored from the prototype's overview metrics.
  const today = new Date().toISOString().slice(0, 10);
  const openRequests = requests.filter(
    (r) => r.status === "open" || r.status === "in_progress",
  );
  const openBreaches = breaches.filter((b) => b.status !== "closed");
  const dpiaReview = dpiaRows.filter(
    (d) => d.status === "review_due" || (d.reviewDate && d.reviewDate < today),
  );
  const published = notices.filter((n) => n.status === "published");
  const noticeState =
    published.length === 0
      ? "None"
      : published.some((n) => n.reviewDate && n.reviewDate < today)
        ? "Review due"
        : "Current";
  const icoObligation = obligations.find((o) => /\bico\b/i.test(o.title));
  const icoState = !icoObligation
    ? "Not tracked"
    : icoObligation.status === "completed"
      ? "Paid"
      : "Check";
  const gaps = assessment?.gaps ?? [];
  const tiles = [
    {
      label: "Readiness",
      value: assessment ? `${assessment.score}/100` : "-",
    },
    { label: "Open gaps", value: String(gaps.length) },
    { label: "Processing activities", value: String(activities.length) },
    { label: "Open data requests", value: String(openRequests.length) },
    { label: "Open breaches", value: String(openBreaches.length) },
    { label: "DPIAs needing review", value: String(dpiaReview.length) },
    { label: "Privacy notice", value: noticeState },
    { label: "ICO fee", value: icoState },
  ];

  const fmtDue = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        })
      : "-";
  const assessmentForClient = assessment
    ? {
        answers: assessment.answers,
        score: assessment.score,
        status: assessment.status,
        gaps: assessment.gaps,
        recommendations: assessment.recommendations as GdprRecommendation[],
        completedAt: assessment.completedAt
          ? assessment.completedAt.toISOString()
          : null,
      }
    : null;

  const label = (base: string, n: number) => (n > 0 ? `${base} (${n})` : base);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            GDPR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data protection, handled properly - your ROPA plus rights requests,
            breaches and impact assessments.
          </p>
        </div>
        <Link
          href="/policies"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-muted"
        >
          Draft a data-protection policy
        </Link>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="gdpr" title="GDPR" />
      </WriteGate>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map((t) => (
          <Card key={t.label} className="p-3">
            <p className="truncate text-lg font-semibold text-foreground">
              {t.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ropa">
            {label("ROPA", activities.length)}
          </TabsTrigger>
          <TabsTrigger value="requests">
            {label("Requests", requests.length)}
          </TabsTrigger>
          <TabsTrigger value="breaches">
            {label("Breaches", breaches.length)}
          </TabsTrigger>
          <TabsTrigger value="dpias">
            {label("DPIAs", dpiaRows.length)}
          </TabsTrigger>
          <TabsTrigger value="notices">
            {label("Notices", notices.length)}
          </TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Open gaps
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                From the latest health check.
              </p>
              {gaps.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {assessment
                    ? "No open gaps - nice work."
                    : "Run the health check (Assessment tab) to see your gaps."}
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {gaps.map((g) => (
                    <li key={g} className="rounded-lg border border-border p-2">
                      {g}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Open data requests
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Statutory clock: one month from receipt.
              </p>
              {openRequests.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No open requests.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {openRequests.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-2"
                    >
                      <span className="min-w-0 truncate text-foreground">
                        <span className="font-medium">
                          {r.requesterReference || "Unreferenced"}
                        </span>{" "}
                        · {r.requestType.replace(/_/g, " ")}
                      </span>
                      <Badge
                        variant={
                          r.dueDate && r.dueDate < today
                            ? "destructive"
                            : "outline"
                        }
                        className="shrink-0"
                      >
                        due {fmtDue(r.dueDate)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ropa" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Your record of processing activities (ROPA).
            </p>
            <WriteGate>
              <NewProcessingActivity />
            </WriteGate>
          </div>
          <GdprBoard activities={activities} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <DataRequestsBoard requests={requests} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="breaches" className="mt-6">
          <DataBreachesBoard breaches={breaches} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="dpias" className="mt-6">
          <DpiaBoard dpias={dpiaRows} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="notices" className="mt-6">
          <PrivacyNoticesBoard notices={notices} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="assessment" className="mt-6">
          <GdprAssessmentPanel
            assessment={assessmentForClient}
            canWrite={canWrite}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
