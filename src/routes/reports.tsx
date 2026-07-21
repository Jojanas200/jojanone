import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useCoreData,
  addReport,
  deleteReport,
  duplicateReport,
  renameReport,
  createConversation,
  appendMessage,
} from "@/data/store";
import { computeSnapshot, formatDate } from "@/data/selectors";
import type { Report, ReportSection, ReportType } from "@/data/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/core/FilterBar";
import { ReportCard, REPORT_LABEL } from "@/components/core/ReportCard";
import { ReportPreviewModal } from "@/components/core/ReportPreviewModal";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { EmptyState } from "@/components/core/EmptyState";
import { MetricCard } from "@/components/core/MetricCard";
import { useNavigate } from "@tanstack/react-router";
import { FileBarChart, FilePlus, FileText } from "lucide-react";
import { toast } from "sonner";
import { getCourse } from "@/data/academy-catalog";
import { academyMetrics, listLearners, progressFor, bestAttempt } from "@/data/academy-selectors";

export const Route = createFileRoute("/reports")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    r: typeof search.r === "string" ? search.r : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reports - Jojan One" },
      { name: "description", content: "Turn your data into evidence." },
    ],
  }),
  component: ReportsPage,
});

interface ReportTypeMeta {
  type: ReportType;
  title: string;
  description: string;
  sources: string[];
  outputs: string[];
}

const REPORT_TYPES: ReportTypeMeta[] = [
  {
    type: "executive_summary",
    title: "Executive Summary",
    description: "Board-ready overview covering position, concerns and decisions required.",
    sources: ["Compliance", "Risk", "HR", "Governance", "Contracts", "GDPR"],
    outputs: ["Executive summary", "Key metrics", "Priority actions", "Decisions required"],
  },
  {
    type: "business_confidence",
    title: "Business Confidence Report",
    description: "Full breakdown of your Business Confidence Score and its drivers.",
    sources: ["All modules"],
    outputs: ["Score history", "Factor breakdown", "Recommendations"],
  },
  {
    type: "compliance_overview",
    title: "Compliance Overview",
    description: "Statutory filings, obligations tracked and current position.",
    sources: ["Compliance"],
    outputs: ["Filing status", "Overdue items", "Upcoming filings"],
  },
  {
    type: "risk_summary",
    title: "Risk Summary",
    description: "Active risks, severity and mitigation status.",
    sources: ["Risk"],
    outputs: ["Risk register", "Severity breakdown", "Mitigations"],
  },
  {
    type: "monthly_activity",
    title: "Monthly Activity Report",
    description: "Everything that happened in your business this month.",
    sources: ["Activity log"],
    outputs: ["Activity by module", "Completed items", "New priorities"],
  },
  {
    type: "training_summary",
    title: "Training and Learning Summary",
    description: "Assignments, completions, quiz outcomes and certificates across Academy.",
    sources: ["Academy", "HR"],
    outputs: ["Assignment status", "Completion rate", "Quiz outcomes", "Certificates"],
  },
];

const PERIOD_OPTIONS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "ytd", label: "Year to date" },
];

const SECTION_OPTIONS = [
  { key: "summary", label: "Executive summary" },
  { key: "metrics", label: "Key metrics" },
  { key: "findings", label: "Findings" },
  { key: "actions", label: "Priority actions" },
  { key: "sources", label: "Source module detail" },
];

function ReportsPage() {
  const state = useCoreData((s) => s);
  const navigate = useNavigate();
  const { r } = Route.useSearch();
  const [previewId, setPreviewId] = useState<string | null>(r ?? null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [configOpen, setConfigOpen] = useState<ReportTypeMeta | null>(null);
  const [renameFor, setRenameFor] = useState<Report | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteFor, setDeleteFor] = useState<Report | null>(null);

  useEffect(() => {
    if (r) setPreviewId(r);
  }, [r]);

  const preview = state.reports.find((x) => x.id === previewId) ?? null;

  const filtered = useMemo(() => {
    const now = Date.now();
    return state.reports
      .filter((x) => (typeFilter === "all" ? true : x.report_type === typeFilter))
      .filter((x) => (statusFilter === "all" ? true : x.status === statusFilter))
      .filter((x) => {
        if (dateFilter === "all") return true;
        const t = new Date(x.created_at).getTime();
        if (dateFilter === "7d") return now - t <= 7 * 86400000;
        if (dateFilter === "30d") return now - t <= 30 * 86400000;
        if (dateFilter === "90d") return now - t <= 90 * 86400000;
        return true;
      })
      .filter((x) => (search.trim() ? x.title.toLowerCase().includes(search.toLowerCase()) : true));
  }, [state.reports, typeFilter, statusFilter, dateFilter, search]);

  const now = new Date();
  const generatedThisMonth = state.reports.filter((r0) => {
    const d = new Date(r0.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const drafts = state.reports.filter((r0) => r0.status === "draft").length;
  const mostRecent = state.reports[0]?.created_at ?? null;

  const askJovaAboutReport = (report: Report) => {
    const convId = createConversation(`Ask Jova about ${report.title}`);
    appendMessage({
      conversation_id: convId,
      sender: "user",
      content: `Summarise ${report.title} and recommend next steps.`,
      reference_type: "report",
      reference_id: report.id,
      suggested_action: null,
    });
    navigate({ to: "/jova", search: { c: convId } });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Turn your data into evidence - exportable reports for lenders, insurers and investors.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total reports" value={state.reports.length} icon={FileBarChart} />
        <MetricCard label="Generated this month" value={generatedThisMonth} icon={FilePlus} />
        <MetricCard label="Drafts" value={drafts} icon={FileText} />
        <MetricCard label="Most recent" value={mostRecent ? formatDate(mostRecent) : "-"} />
      </div>

      <h2 className="mt-10 text-[16px] font-semibold text-foreground">Generate a report</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_TYPES.map((rt) => (
          <Card key={rt.type} className="flex flex-col gap-3 border border-border bg-card p-5 shadow-none">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
                  <FileBarChart className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[15px] font-semibold text-foreground">{rt.title}</p>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{rt.description}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <dt className="text-muted-foreground">Sources</dt>
                <dd className="text-foreground">{rt.sources.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Includes</dt>
                <dd className="text-foreground">{rt.outputs.join(", ")}</dd>
              </div>
            </dl>
            <Button size="sm" className="mt-auto self-start" onClick={() => setConfigOpen(rt)}>
              Generate report
            </Button>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-[16px] font-semibold text-foreground">Reports library</h2>
      <div className="mt-3">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search reports…"
          onClear={() => {
            setSearch("");
            setTypeFilter("all");
            setDateFilter("all");
            setStatusFilter("all");
          }}
          fields={[
            {
              key: "type",
              label: "Type",
              value: typeFilter,
              onChange: setTypeFilter,
              options: [
                { value: "all", label: "All types" },
                ...Object.entries(REPORT_LABEL).map(([v, l]) => ({ value: v, label: l })),
              ],
            },
            {
              key: "date",
              label: "Date",
              value: dateFilter,
              onChange: setDateFilter,
              options: [
                { value: "all", label: "Any time" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
              ],
            },
            {
              key: "status",
              label: "Status",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: "all", label: "Any status" },
                { value: "final", label: "Final" },
                { value: "draft", label: "Draft" },
              ],
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={FileBarChart}
              title={search || typeFilter !== "all" ? "No reports match your filters" : "No reports yet"}
              description="Generate your first report using one of the templates above."
            />
          </div>
        ) : (
          filtered.map((rep) => (
            <ReportCard
              key={rep.id}
              report={rep}
              onOpen={() => setPreviewId(rep.id)}
              onRename={() => {
                setRenameFor(rep);
                setRenameValue(rep.title);
              }}
              onDuplicate={() => {
                const id = duplicateReport(rep.id);
                if (id) toast.success("Report duplicated");
              }}
              onDelete={() => setDeleteFor(rep)}
            />
          ))
        )}
      </div>

      {configOpen && (
        <GenerateReportDialog
          meta={configOpen}
          onCancel={() => setConfigOpen(null)}
          onGenerate={(cfg) => {
            const snap = computeSnapshot(state);
            const sections: ReportSection[] = [];
            if (configOpen.type === "training_summary") {
              const am = academyMetrics(state);
              if (cfg.includes.summary) {
                sections.push({
                  heading: "Learning position",
                  body: `Overall learning progress ${am.overallProgressPct}%. ${am.completed} course completion(s), ${am.inProgress} in progress, ${am.overdue} overdue. ${am.certificatesEarned} certificate(s) earned. ${am.recommendedCount} recommendation(s) based on current business gaps.`,
                });
              }
              if (cfg.includes.sources) {
                const learners = listLearners(state);
                learners.forEach((l) => {
                  const assigns = state.academy_assignments.filter((a) => a.learner_id === l.id);
                  if (assigns.length === 0) return;
                  const bullets = assigns.map((a) => {
                    const c = getCourse(a.course_id);
                    const p = progressFor(state, l.id, a.course_id);
                    const q = bestAttempt(state, l.id, a.course_id);
                    const pct = c && p ? Math.round((p.lessons_completed.length / Math.max(1, c.lessons.length)) * 100) : 0;
                    return `${c?.title ?? a.course_id} - ${a.status} · ${pct}% lessons${q ? ` · best quiz ${q.score}%` : ""}`;
                  });
                  sections.push({ heading: `${l.name} (${l.role})`, body: `${assigns.length} assignment(s).`, bullets });
                });
              }
            } else {
              if (cfg.includes.summary) sections.push({ heading: "Overall position", body: snap.explanation });
              if (cfg.includes.sources) {
                state.areas.forEach((a) => {
                  sections.push({ heading: a.label, body: a.summary, bullets: [a.top_concern] });
                });
              }
            }
            const id = addReport({
              report_type: configOpen.type,
              title: `${configOpen.title} - ${PERIOD_OPTIONS.find((p) => p.value === cfg.period)?.label ?? cfg.period}`,
              reporting_period: PERIOD_OPTIONS.find((p) => p.value === cfg.period)?.label ?? cfg.period,
              summary: configOpen.type === "training_summary"
                ? `Overall learning progress ${academyMetrics(state).overallProgressPct}%. ${academyMetrics(state).completed} completions, ${academyMetrics(state).overdue} overdue.`
                : snap.explanation,
              sections,
              metrics: cfg.includes.metrics
                ? (configOpen.type === "training_summary"
                    ? (() => {
                        const am = academyMetrics(state);
                        return [
                          { label: "Overall progress", value: `${am.overallProgressPct}%` },
                          { label: "Completed", value: String(am.completed) },
                          { label: "In progress", value: String(am.inProgress) },
                          { label: "Overdue", value: String(am.overdue) },
                          { label: "Certificates", value: String(am.certificatesEarned) },
                          { label: "Learning hours", value: `${Math.round(am.learningMinutes / 6) / 10}` },
                        ];
                      })()
                    : [
                    { label: "Confidence Score", value: `${snap.score}/100` },
                    { label: "Open priorities", value: String(snap.open_priorities) },
                    { label: "Overdue", value: String(snap.overdue_actions) },
                    { label: "Completed this month", value: String(snap.completed_this_month) },
                    ])
                : [],
              findings: cfg.includes.findings
                ? (configOpen.type === "training_summary"
                    ? state.academy_assignments.filter((a) => a.status !== "completed" && a.due_date && new Date(a.due_date).getTime() < Date.now())
                        .map((a) => `${a.learner_name} - ${getCourse(a.course_id)?.title ?? a.course_id} overdue`)
                    : state.activities.filter((a) => a.priority === "high").map((a) => a.title))
                : [],
              priority_actions: cfg.includes.actions
                ? (configOpen.type === "training_summary"
                    ? state.academy_assignments.filter((a) => a.status !== "completed").slice(0, 8).map((a) => `Follow up: ${a.learner_name} - ${getCourse(a.course_id)?.title ?? a.course_id}`)
                    : state.activities
                    .filter((a) => a.priority === "high" && a.status !== "completed")
                    .map((a) => a.title))
                : [],
              source_modules:
                configOpen.type === "risk_summary"
                  ? ["risk"]
                  : configOpen.type === "compliance_overview"
                    ? ["compliance"]
                    : configOpen.type === "training_summary"
                      ? ["academy", "hr"]
                    : ["compliance", "risk", "hr", "governance", "contracts", "gdpr"],
            });
            setConfigOpen(null);
            setPreviewId(id);
            toast.success("Report generated");
          }}
        />
      )}

      <ReportPreviewModal
        report={preview}
        open={!!preview}
        onOpenChange={(v) => !v && setPreviewId(null)}
        onAskJova={(r0) => {
          setPreviewId(null);
          askJovaAboutReport(r0);
        }}
      />

      <Dialog open={!!renameFor} onOpenChange={(v) => !v && setRenameFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename report</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameFor && renameValue.trim()) {
                  renameReport(renameFor.id, renameValue.trim());
                  setRenameFor(null);
                  toast.success("Report renamed");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteFor}
        onOpenChange={(v) => !v && setDeleteFor(null)}
        title="Delete this report?"
        description="This cannot be undone."
        destructive
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteFor) {
            deleteReport(deleteFor.id);
            setDeleteFor(null);
            toast.success("Report deleted");
          }
        }}
      />
    </div>
  );
}

function GenerateReportDialog({
  meta,
  onCancel,
  onGenerate,
}: {
  meta: ReportTypeMeta;
  onCancel: () => void;
  onGenerate: (cfg: { period: string; includes: Record<string, boolean> }) => void;
}) {
  const [period, setPeriod] = useState("this_month");
  const [includes, setIncludes] = useState<Record<string, boolean>>({
    summary: true,
    metrics: true,
    findings: true,
    actions: true,
    sources: true,
  });
  const [generating, setGenerating] = useState(false);
  const valid = Object.values(includes).some(Boolean);

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate {meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-[13px]">Reporting period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px]">Sections to include</Label>
            <div className="mt-2 space-y-2">
              {SECTION_OPTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={!!includes[s.key]}
                    onCheckedChange={(v) => setIncludes((prev) => ({ ...prev, [s.key]: !!v }))}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            {!valid && (
              <p className="mt-2 text-[12px] text-destructive">Select at least one section.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={generating}>
            Cancel
          </Button>
          <Button
            disabled={!valid || generating}
            onClick={() => {
              setGenerating(true);
              setTimeout(() => onGenerate({ period, includes }), 600);
            }}
          >
            {generating ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}