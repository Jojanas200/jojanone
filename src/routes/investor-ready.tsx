import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  Plus,
  FileBarChart,
  Sparkles,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  Edit,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/core/MetricCard";
import { StatusPill } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import {
  SectionHeader,
  ReadinessScoreCard,
  ReadinessBreakdown,
  ddStatusTone,
  drStatusTone,
  InfoRow,
  formatCurrency,
  printHtml,
  investorDisclaimer,
} from "@/components/growth/shared";
import {
  useCoreData,
  upsertInvestorProfile,
  newInvestorProfileDraft,
  upsertDueDiligenceItem,
  setDdStatus,
  upsertDataRoomItem,
  archiveDataRoomItem,
  restoreDataRoomItem,
  deleteDataRoomItem,
  newDataRoomItemDraft,
  saveInvestorReadinessAssessment,
  newInvestorAssessmentDraft,
  addReport,
  createConversation,
  appendMessage,
} from "@/data/store";
import {
  investorReadinessMetrics,
  computeReadinessAssessment,
  categoryLabel,
  ddStatusLabel,
} from "@/data/growth-selectors";
import { formatDate } from "@/data/selectors";
import type {
  DueDiligenceItem,
  DDCategory,
  DDStatus,
  DataRoomFolder,
  DataRoomItem,
  InvestorProfile,
  FundingStage,
  InvestmentType,
} from "@/data/types";

export const Route = createFileRoute("/investor-ready")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    dd: typeof s.dd === "string" ? s.dd : undefined,
    dr: typeof s.dr === "string" ? s.dr : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Investor Ready - Jojan One" },
      { name: "description", content: "Investor due-diligence readiness, maintained continuously." },
    ],
  }),
  component: InvestorReadyPage,
});

const CATEGORY_ORDER: DDCategory[] = [
  "corporate",
  "financial",
  "legal",
  "compliance",
  "commercial",
  "people",
  "data_room",
];

const DR_FOLDERS: { key: DataRoomFolder; label: string }[] = [
  { key: "corporate", label: "Corporate" },
  { key: "ownership", label: "Ownership" },
  { key: "financial", label: "Financial" },
  { key: "tax", label: "Tax" },
  { key: "commercial", label: "Commercial" },
  { key: "contracts", label: "Contracts" },
  { key: "people", label: "People" },
  { key: "ip", label: "IP" },
  { key: "compliance", label: "Compliance" },
  { key: "gdpr", label: "GDPR" },
  { key: "governance", label: "Governance" },
  { key: "risk_insurance", label: "Risk and insurance" },
  { key: "investor_materials", label: "Investor materials" },
];

function InvestorReadyPage() {
  const state = useCoreData((s) => s);
  const { dd, dr } = Route.useSearch();
  const navigate = useNavigate();

  const metrics = useMemo(() => investorReadinessMetrics(state), [state]);
  const profile = state.investor_profiles[0] ?? null;

  const [profileOpen, setProfileOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [ddOpen, setDdOpen] = useState<DueDiligenceItem | null>(null);
  const [drItemOpen, setDrItemOpen] = useState<DataRoomItem | null>(null);
  const [drAdd, setDrAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  const [naOpen, setNaOpen] = useState<DueDiligenceItem | null>(null);
  const [ddSearch, setDdSearch] = useState("");
  const [ddCat, setDdCat] = useState<"all" | DDCategory>("all");
  const [ddStatusFilter, setDdStatusFilter] = useState<"all" | DDStatus>("all");
  const [ddPriority, setDdPriority] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => {
    if (dd) {
      const item = state.due_diligence_items.find((i) => i.id === dd);
      if (item) setDdOpen(item);
    }
    if (dr) {
      const item = state.data_room_items.find((i) => i.id === dr);
      if (item) setDrItemOpen(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDd = useMemo(() => {
    const q = ddSearch.trim().toLowerCase();
    return state.due_diligence_items.filter((i) => {
      if (q && !i.title.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) return false;
      if (ddCat !== "all" && i.category !== ddCat) return false;
      if (ddStatusFilter !== "all" && i.status !== ddStatusFilter) return false;
      if (ddPriority !== "all" && i.priority !== ddPriority) return false;
      return true;
    });
  }, [state.due_diligence_items, ddSearch, ddCat, ddStatusFilter, ddPriority]);

  const categoryScores = CATEGORY_ORDER.map((c) => ({
    category: c,
    label: categoryLabel(c),
    score: metrics.categoryScores[c],
    note: describeCategory(c, metrics.items.filter((i) => i.category === c)),
  }));

  const generateReport = () => {
    const assessment = computeReadinessAssessment(state);
    const id = addReport({
      report_type: "executive_summary",
      title: `Investor Readiness Report - ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
      reporting_period: "Point in time",
      summary: `Overall Investor Readiness ${assessment.overall_score}/100. ${metrics.ready} due-diligence items ready, ${metrics.missing} missing, ${metrics.needsReview} needing review.`,
      metrics: [
        { label: "Overall readiness", value: `${assessment.overall_score}/100` },
        { label: "Ready items", value: String(metrics.ready) },
        { label: "Missing", value: String(metrics.missing) },
        { label: "Needs review", value: String(metrics.needsReview) },
        { label: "Data room", value: `${metrics.dataRoomComplete}%` },
        { label: "High-priority gaps", value: String(metrics.highPriorityGaps.length) },
      ],
      findings: assessment.gaps.slice(0, 10),
      priority_actions: assessment.recommended_actions.slice(0, 8).map((a) => a.label),
      sections: [
        { heading: "Funding profile", body: profile
          ? `${profile.funding_stage} - seeking ${formatCurrency(profile.amount_sought, profile.currency)} for ${profile.funding_purpose}`
          : "No funding profile recorded." },
        ...CATEGORY_ORDER.map((c) => ({
          heading: categoryLabel(c),
          body: `Score ${metrics.categoryScores[c]}/100. ${describeCategory(c, metrics.items.filter((i) => i.category === c))}`,
        })),
        { heading: "Red flags", body: assessment.red_flags.length ? assessment.red_flags.join(", ") : "No red flags recorded." },
      ],
      source_modules: ["governance", "contracts", "hr", "compliance", "gdpr", "risk"],
    });
    setReportPreview(id);
    toast.success("Investor Readiness Report generated");
  };

  const askJova = (question: string, refType?: string, refId?: string) => {
    const convId = createConversation(question.slice(0, 60));
    appendMessage({
      conversation_id: convId,
      sender: "user",
      content: question,
      reference_type: refType ?? null,
      reference_id: refId ?? null,
      suggested_action: null,
    });
    navigate({ to: "/jova", search: { c: convId } });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <TrendingUp className="h-6 w-6 text-primary" /> Investor Ready
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            Track investor due-diligence, organise your data room, and be ready before investors ask.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAssessOpen(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Run assessment
          </Button>
          <Button onClick={generateReport}>
            <FileBarChart className="mr-1.5 h-4 w-4" /> Generate report
          </Button>
        </div>
      </div>

      <p className="mt-3 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-3 py-2 text-[12px] text-muted-foreground">
        {investorDisclaimer}
      </p>

      {/* Overview */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <ReadinessScoreCard
          score={metrics.overallScore}
          label="Investor Readiness Score"
          hint={`${metrics.ready} ready · ${metrics.missing} missing · ${metrics.needsReview} to review`}
          onDetails={() => setBreakdownOpen(true)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Funding profile" value={profile ? profile.status : "None"} hint={profile ? `${formatCurrency(profile.amount_sought, profile.currency)} ${profile.funding_stage}` : "Create one"} onClick={() => setProfileOpen(true)} />
          <MetricCard label="Ready items" value={metrics.ready} icon={CheckCircle2} tone="success" />
          <MetricCard label="Missing docs" value={metrics.missing} icon={AlertTriangle} tone={metrics.missing > 0 ? "danger" : "default"} />
          <MetricCard label="Needs review" value={metrics.needsReview} icon={AlertTriangle} tone={metrics.needsReview > 0 ? "warning" : "default"} />
          <MetricCard label="High-priority gaps" value={metrics.highPriorityGaps.length} tone={metrics.highPriorityGaps.length > 0 ? "warning" : "default"} />
          <MetricCard label="Data room" value={`${metrics.dataRoomComplete}%`} icon={FolderOpen} hint={`${metrics.dataRoomReady} of ${metrics.dataRoomTotal} ready`} />
        </div>
      </div>

      {/* Readiness breakdown */}
      <div className="mt-10">
        <SectionHeader title="Readiness breakdown" description="Category scores derived from your due-diligence items." />
        <Card className="mt-4 border border-border bg-card p-5 shadow-none">
          <ReadinessBreakdown
            scores={categoryScores}
            onOpen={(c) => setDdCat(c as DDCategory)}
          />
          <Button variant="ghost" size="sm" className="mt-4 h-8 justify-start p-0 text-primary" onClick={() => setBreakdownOpen(true)}>
            How is this calculated? <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Card>
      </div>

      {/* Funding profile */}
      <div className="mt-10">
        <SectionHeader
          title="Funding profile"
          description="What you're raising and why. Jojan One organises the information; it does not recommend a structure or valuation."
          action={
            <Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}>
              <Edit className="mr-1.5 h-3.5 w-3.5" /> {profile ? "Edit" : "Create"}
            </Button>
          }
        />
        {profile ? (
          <Card className="mt-4 border border-border bg-card p-5 shadow-none">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <InfoRow label="Stage" value={profile.funding_stage.replace("_", " ")} />
              <InfoRow label="Amount sought" value={formatCurrency(profile.amount_sought, profile.currency)} />
              <InfoRow label="Investment type" value={profile.investment_type} />
              <InfoRow label="Target close" value={profile.target_close_date ? formatDate(profile.target_close_date) : "-"} />
              <InfoRow label="Revenue band" value={profile.current_revenue_band} />
              <InfoRow label="Status" value={profile.status} />
            </div>
            <div className="mt-4 grid gap-3">
              <InfoRow label="Purpose" value={profile.funding_purpose} />
              <InfoRow label="Growth" value={profile.growth_summary} />
              <InfoRow label="Traction" value={profile.traction_summary} />
              <InfoRow label="Market" value={profile.market_summary} />
              <InfoRow label="Team" value={profile.team_summary} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => printProfile(profile, state.business.name)}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print summary
              </Button>
              <Button size="sm" variant="ghost" onClick={() => askJova("Summarise our funding profile.", "investor_profile", profile.id)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState title="No funding profile" description="Create one to organise your investor materials." action={<Button size="sm" onClick={() => setProfileOpen(true)}>Create funding profile</Button>} />
        )}
      </div>

      {/* Due diligence */}
      <div className="mt-10">
        <SectionHeader
          title="Due-diligence checklist"
          description="Manage every item investors typically request during due diligence."
          action={
            <Button size="sm" variant="outline" onClick={() => setDdOpen({ ...newDdItemDraft() })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={ddSearch} onChange={(e) => setDdSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
          </div>
          <Select value={ddCat} onValueChange={(v) => setDdCat(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_ORDER.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ddStatusFilter} onValueChange={(v) => setDdStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["missing","in_progress","needs_review","ready","not_applicable"] as DDStatus[]).map((s) => <SelectItem key={s} value={s}>{ddStatusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ddPriority} onValueChange={(v) => setDdPriority(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-2">
          {filteredDd.length === 0 ? (
            <EmptyState title="No matching items" description="Adjust your filters or add a new item." />
          ) : (
            filteredDd.map((i) => (
              <Card key={i.id} className="flex flex-wrap items-center gap-3 border border-border bg-card p-4 shadow-none">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-foreground">{i.title}</p>
                    <StatusPill tone={ddStatusTone(i.status)}>{ddStatusLabel(i.status)}</StatusPill>
                    <StatusPill tone={i.priority === "high" ? "danger" : i.priority === "medium" ? "warning" : "neutral"}>{i.priority}</StatusPill>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{categoryLabel(i.category)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{i.description}</p>
                  {i.source_module && (
                    <button
                      type="button"
                      className="mt-1 text-[12px] text-primary hover:underline"
                      onClick={() => navigate({ to: `/${i.source_module}` as any })}
                    >
                      Open {i.source_module}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {i.status !== "ready" && (
                    <Button size="sm" variant="outline" onClick={() => { setDdStatus(i.id, "ready"); toast.success("Marked ready"); }}>
                      Mark ready
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDdOpen(i)}>Open</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Data Room */}
      <div className="mt-10">
        <SectionHeader
          title="Data Room"
          description="Structured index of investor materials. Jojan One does not claim documents have been professionally reviewed."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDrAdd(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
              </Button>
              <Button size="sm" variant="ghost" onClick={() => printDataRoom(state.data_room_items, state.business.name)}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print index
              </Button>
            </div>
          }
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DR_FOLDERS.map(({ key, label }) => {
            const items = state.data_room_items.filter((i) => i.folder === key && i.status !== "archived");
            const ready = items.filter((i) => i.status === "ready").length;
            return (
              <Card key={key} className="flex flex-col gap-3 border border-border bg-card p-4 shadow-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <p className="text-[14px] font-semibold text-foreground">{label}</p>
                  </div>
                  <StatusPill tone={items.length === 0 ? "neutral" : ready === items.length ? "success" : "info"}>
                    {ready}/{items.length}
                  </StatusPill>
                </div>
                <div className="space-y-1.5">
                  {items.length === 0 && <p className="text-[12px] text-muted-foreground">No items yet.</p>}
                  {items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setDrItemOpen(i)}
                      className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
                    >
                      <span className="truncate">{i.title}</span>
                      <StatusPill tone={drStatusTone(i.status)}>{i.status.replace("_", " ")}</StatusPill>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Action plan */}
      <div className="mt-10">
        <SectionHeader title="Investor action plan" description="Prioritised items to close the biggest gaps first." />
        <div className="mt-3 space-y-2">
          {metrics.openActions.length === 0 ? (
            <EmptyState title="No open actions" description="Everything is ready or not applicable." />
          ) : (
            metrics.openActions.slice(0, 8).map((i) => (
              <Card key={i.id} className="flex flex-wrap items-center gap-3 border border-border bg-card p-4 shadow-none">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-foreground">{i.title}</p>
                    <StatusPill tone={i.priority === "high" ? "danger" : i.priority === "medium" ? "warning" : "neutral"}>{i.priority}</StatusPill>
                    <span className="text-[11px] text-muted-foreground">{categoryLabel(i.category)}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Suggested owner: {i.owner}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDdOpen(i)}>Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => askJova(`Explain this due-diligence item: ${i.title}`, "dd_item", i.id)}>
                    Ask Jova
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Report link */}
      {reportPreview && (
        <div className="mt-8 rounded-lg border border-border bg-[oklch(0.98_0.003_260)] p-4">
          <p className="text-[13px] font-semibold text-foreground">Report saved to Reports Library.</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            <button type="button" className="text-primary hover:underline" onClick={() => navigate({ to: "/reports", search: { r: reportPreview } })}>
              Open in Reports →
            </button>
          </p>
        </div>
      )}

      {/* ---- Funding profile dialog ---- */}
      <FundingProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={profile}
        onSave={(p) => { upsertInvestorProfile(p); toast.success("Funding profile saved"); }}
      />

      {/* ---- Assessment dialog ---- */}
      <AssessmentDialog open={assessOpen} onOpenChange={setAssessOpen} onComplete={(answers) => {
        const draft = newInvestorAssessmentDraft();
        const computed = computeReadinessAssessment(state);
        saveInvestorReadinessAssessment({
          ...draft,
          ...computed,
          answers,
          status: "completed",
          completed_at: new Date().toISOString(),
          review_date: new Date(Date.now() + 90 * 86400000).toISOString(),
        });
        toast.success("Investor readiness assessment completed");
      }} />

      {/* ---- Breakdown drawer ---- */}
      <DetailDrawer
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        title="How the readiness score is calculated"
        description={`Overall ${metrics.overallScore}/100`}
      >
        <p className="text-[13px] text-muted-foreground">
          Each category score is the average of your due-diligence items in that category. Ready and Not applicable count as 100. Needs review counts as 70. In progress counts as 40. Missing counts as 0. The overall score is the mean of the seven category scores.
        </p>
        <div className="mt-4">
          <ReadinessBreakdown scores={categoryScores} />
        </div>
      </DetailDrawer>

      {/* ---- Due-diligence item drawer ---- */}
      <DdItemDialog
        item={ddOpen}
        onOpenChange={(v) => !v && setDdOpen(null)}
        onSave={(item) => { upsertDueDiligenceItem(item); setDdOpen(null); toast.success("Item saved"); }}
        onNotApplicable={(item) => setNaOpen(item)}
        onAskJova={(item) => askJova(`Explain this due-diligence item: ${item.title}`, "dd_item", item.id)}
        onOpenSource={(item) => item.source_module && navigate({ to: `/${item.source_module}` as any })}
      />

      {/* ---- Data-room dialog ---- */}
      <DrItemDialog
        item={drItemOpen}
        add={drAdd}
        onOpenChange={(v) => { if (!v) { setDrItemOpen(null); setDrAdd(false); } }}
        onSave={(item) => { upsertDataRoomItem(item); setDrItemOpen(null); setDrAdd(false); toast.success("Data-room item saved"); }}
        onArchive={(id) => { archiveDataRoomItem(id); setDrItemOpen(null); toast.success("Archived"); }}
        onRestore={(id) => { restoreDataRoomItem(id); setDrItemOpen(null); toast.success("Restored"); }}
        onDelete={(id) => setConfirmDelete(id)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete data-room item?"
        description="This cannot be undone."
        destructive
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) deleteDataRoomItem(confirmDelete);
          setConfirmDelete(null);
        }}
      />

      {/* NA reason */}
      <Dialog open={!!naOpen} onOpenChange={(v) => !v && setNaOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark not applicable</DialogTitle>
            <DialogDescription>Record why this item does not apply.</DialogDescription>
          </DialogHeader>
          <NaForm onSubmit={(reason) => {
            if (naOpen) { setDdStatus(naOpen.id, "not_applicable", reason); toast.success("Marked not applicable"); }
            setNaOpen(null);
            setDdOpen(null);
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function describeCategory(c: DDCategory, items: DueDiligenceItem[]) {
  if (items.length === 0) return "No items recorded.";
  const ready = items.filter((i) => i.status === "ready").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const needs = items.filter((i) => i.status === "needs_review").length;
  return `${ready}/${items.length} ready · ${missing} missing · ${needs} to review.`;
}

function newDdItemDraft(): DueDiligenceItem {
  const now = new Date().toISOString();
  return {
    id: `dd_${Math.random().toString(36).slice(2, 9)}`,
    business_id: "biz_anastasia",
    category: "corporate",
    title: "",
    description: "",
    required: true,
    status: "missing",
    evidence_reference: "",
    source_module: null,
    source_record_id: null,
    owner: "Anastasia",
    priority: "medium",
    review_date: null,
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

function FundingProfileDialog({
  open, onOpenChange, profile, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; profile: InvestorProfile | null; onSave: (p: InvestorProfile) => void }) {
  const [draft, setDraft] = useState<InvestorProfile>(profile ?? newInvestorProfileDraft());
  useEffect(() => { setDraft(profile ?? newInvestorProfileDraft()); }, [profile, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit funding profile" : "Create funding profile"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Funding stage</Label>
            <Select value={draft.funding_stage} onValueChange={(v) => setDraft({ ...draft, funding_stage: v as FundingStage })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_seed">Pre-seed</SelectItem>
                <SelectItem value="seed">Seed</SelectItem>
                <SelectItem value="early_growth">Early growth</SelectItem>
                <SelectItem value="series_a">Series A</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Investment type</Label>
            <Select value={draft.investment_type} onValueChange={(v) => setDraft({ ...draft, investment_type: v as InvestmentType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="convertible">Convertible instrument</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="grant">Grant</SelectItem>
                <SelectItem value="undecided">Undecided</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount sought (GBP)</Label>
            <Input type="number" value={draft.amount_sought} onChange={(e) => setDraft({ ...draft, amount_sought: Number(e.target.value || 0) })} />
          </div>
          <div>
            <Label>Target close date</Label>
            <Input type="date" value={draft.target_close_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, target_close_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          <div>
            <Label>Current revenue band</Label>
            <Input value={draft.current_revenue_band} onChange={(e) => setDraft({ ...draft, current_revenue_band: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="in_market">In market</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Purpose</Label>
            <Textarea rows={2} value={draft.funding_purpose} onChange={(e) => setDraft({ ...draft, funding_purpose: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Growth summary</Label>
            <Textarea rows={2} value={draft.growth_summary} onChange={(e) => setDraft({ ...draft, growth_summary: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Traction summary</Label>
            <Textarea rows={2} value={draft.traction_summary} onChange={(e) => setDraft({ ...draft, traction_summary: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Market summary</Label>
            <Textarea rows={2} value={draft.market_summary} onChange={(e) => setDraft({ ...draft, market_summary: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Team summary</Label>
            <Textarea rows={2} value={draft.team_summary} onChange={(e) => setDraft({ ...draft, team_summary: e.target.value })} />
          </div>
        </div>
        <p className="mt-2 rounded border border-border bg-[oklch(0.98_0.003_260)] px-3 py-2 text-[11px] text-muted-foreground">
          Jojan One organises investment-readiness information. It does not recommend an investment structure, valuation or investment decision.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(draft); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ASSESSMENT_STEPS = [
  { key: "corporate", label: "Corporate structure", questions: [
    { id: "q_incorp", text: "Are your certificate of incorporation and articles filed and accessible?" },
    { id: "q_psc", text: "Is your PSC and members' register up to date?" },
    { id: "q_captable", text: "Do you have a current cap table with option pool?" },
  ]},
  { key: "financial", label: "Financial records", questions: [
    { id: "q_accounts", text: "Are your last three statutory accounts filed?" },
    { id: "q_mgmt", text: "Do you produce monthly management accounts?" },
    { id: "q_forecast", text: "Do you have a 3-year financial forecast with sensitivities?" },
    { id: "q_tax", text: "Is your tax position (VAT, PAYE, CT) up to date?" },
  ]},
  { key: "legal", label: "Legal and contracts", questions: [
    { id: "q_contracts", text: "Are your material contracts organised and reviewed?" },
    { id: "q_ip", text: "Are IP assignments in place for staff and contractors?" },
    { id: "q_disputes", text: "Are you free of material disputes and litigation?" },
  ]},
  { key: "compliance", label: "Compliance and data", questions: [
    { id: "q_gdpr", text: "Is your GDPR position organised (ROPA, notices, DPIAs)?" },
    { id: "q_reg", text: "Are your regulatory obligations up to date?" },
    { id: "q_insurance", text: "Do you hold appropriate insurance?" },
  ]},
  { key: "commercial", label: "Commercial and market", questions: [
    { id: "q_plan", text: "Do you have a current business plan?" },
    { id: "q_traction", text: "Can you evidence customer traction and retention?" },
    { id: "q_market", text: "Do you have a documented market analysis?" },
  ]},
  { key: "people", label: "People", questions: [
    { id: "q_emp", text: "Are all employee contracts signed and current?" },
    { id: "q_contractor", text: "Are contractor arrangements documented with SDS where required?" },
  ]},
  { key: "data_room", label: "Data room", questions: [
    { id: "q_dr_index", text: "Is your data-room folder structure in place?" },
    { id: "q_dr_pitch", text: "Do you have an investor pitch deck?" },
  ]},
];

function AssessmentDialog({ open, onOpenChange, onComplete }: { open: boolean; onOpenChange: (v: boolean) => void; onComplete: (answers: Record<string, string>) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setStep(0); setAnswers({}); } }, [open]);
  const total = ASSESSMENT_STEPS.length;
  const current = ASSESSMENT_STEPS[step];
  const done = step === total;
  const progress = Math.round(((done ? total : step) / total) * 100);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Investor Readiness Assessment</DialogTitle>
          <DialogDescription>
            {done ? "Review answers and generate a deterministic result." : `${current.label} - step ${step + 1} of ${total}`}
          </DialogDescription>
        </DialogHeader>
        <Progress value={progress} className="h-1.5" />
        {done ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Answers are used together with your recorded due-diligence items to produce a deterministic Investor Readiness Score, gap analysis, red-flag summary and prioritised action plan.
            </p>
            <ul className="max-h-[220px] space-y-1 overflow-y-auto rounded-md border border-border p-3 text-[12px]">
              {ASSESSMENT_STEPS.flatMap((s) => s.questions).map((q) => (
                <li key={q.id}>
                  <span className="text-muted-foreground">{q.text}</span> - <strong>{answers[q.id] ?? "unanswered"}</strong>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Where professional judgement is required (investment structure, valuation, tax reliefs such as SEIS/EIS, share issuance), seek qualified support.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {current.questions.map((q) => (
              <div key={q.id} className="rounded-md border border-border p-3">
                <p className="text-[13px] font-medium text-foreground">{q.text}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["yes","partial","no","unsure","na"].map((opt) => (
                    <Button
                      key={opt}
                      size="sm"
                      variant={answers[q.id] === opt ? "default" : "outline"}
                      onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                    >
                      {opt === "na" ? "N/A" : opt}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Save & exit</Button>
          {step > 0 && !done && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {!done && (
            <Button
              disabled={current.questions.some((q) => !answers[q.id])}
              onClick={() => setStep(step + 1)}
            >
              {step === total - 1 ? "Review" : "Next"}
            </Button>
          )}
          {done && (
            <Button onClick={() => { onComplete(answers); onOpenChange(false); }}>
              Save assessment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DdItemDialog({
  item, onOpenChange, onSave, onNotApplicable, onAskJova, onOpenSource,
}: {
  item: DueDiligenceItem | null;
  onOpenChange: (v: boolean) => void;
  onSave: (i: DueDiligenceItem) => void;
  onNotApplicable: (i: DueDiligenceItem) => void;
  onAskJova: (i: DueDiligenceItem) => void;
  onOpenSource: (i: DueDiligenceItem) => void;
}) {
  const [draft, setDraft] = useState<DueDiligenceItem | null>(item);
  useEffect(() => setDraft(item), [item]);
  if (!draft) return null;
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft.title || "New due-diligence item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as DDCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as DDStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["missing","in_progress","needs_review","ready","not_applicable"] as DDStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ddStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Owner</Label>
            <Input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
          </div>
          <div>
            <Label>Evidence reference</Label>
            <Input value={draft.evidence_reference} onChange={(e) => setDraft({ ...draft, evidence_reference: e.target.value })} />
          </div>
          <div>
            <Label>Review date</Label>
            <Input type="date" value={draft.review_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, review_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
          {draft.source_module && (
            <div className="sm:col-span-2 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-3 py-2 text-[12px]">
              Linked to <strong>{draft.source_module}</strong>{" "}
              <button type="button" className="ml-2 text-primary hover:underline" onClick={() => onOpenSource(draft)}>
                Open source record →
              </button>
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onAskJova(draft)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
          </Button>
          <Button variant="outline" onClick={() => onNotApplicable(draft)}>Mark N/A</Button>
          <Button variant="outline" onClick={() => setDraft({ ...draft, status: "needs_review" })}>Mark needs review</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DrItemDialog({
  item, add, onOpenChange, onSave, onArchive, onRestore, onDelete,
}: {
  item: DataRoomItem | null;
  add: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (i: DataRoomItem) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const open = !!item || add;
  const [draft, setDraft] = useState<DataRoomItem>(item ?? newDataRoomItemDraft());
  useEffect(() => { setDraft(item ?? newDataRoomItemDraft()); }, [item, add]);
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? draft.title || "Data-room item" : "Add data-room item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <Label>Folder</Label>
            <Select value={draft.folder} onValueChange={(v) => setDraft({ ...draft, folder: v as DataRoomFolder })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DR_FOLDERS.map(({ key, label }) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document type</Label>
            <Input value={draft.document_type} onChange={(e) => setDraft({ ...draft, document_type: e.target.value })} />
          </div>
          <div>
            <Label>Version</Label>
            <Input value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} />
          </div>
          <div>
            <Label>File name</Label>
            <Input value={draft.file_name} onChange={(e) => setDraft({ ...draft, file_name: e.target.value })} />
          </div>
          <div>
            <Label>Confidentiality</Label>
            <Select value={draft.confidentiality} onValueChange={(v) => setDraft({ ...draft, confidentiality: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="confidential">Confidential</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Review date</Label>
            <Input type="date" value={draft.review_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, review_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {item && (item.status !== "archived" ? (
            <Button variant="outline" onClick={() => onArchive(item.id)}>Archive</Button>
          ) : (
            <Button variant="outline" onClick={() => onRestore(item.id)}>Restore</Button>
          ))}
          {item && <Button variant="ghost" className="text-destructive" onClick={() => onDelete(item.id)}>Delete</Button>}
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NaForm({ onSubmit }: { onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <Label>Reason</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <DialogFooter>
        <Button disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>Confirm</Button>
      </DialogFooter>
    </div>
  );
}

function printProfile(p: InvestorProfile, businessName: string) {
  const html = `
    <div class="brand">Jojan One - Funding Profile</div>
    <h1>${businessName}</h1>
    <p class="meta">Prepared ${new Date().toLocaleDateString("en-GB")}</p>
    <div class="grid">
      <div class="metric"><div class="l">Stage</div><div class="v">${p.funding_stage}</div></div>
      <div class="metric"><div class="l">Amount sought</div><div class="v">${p.currency} ${p.amount_sought.toLocaleString()}</div></div>
      <div class="metric"><div class="l">Investment type</div><div class="v">${p.investment_type}</div></div>
      <div class="metric"><div class="l">Target close</div><div class="v">${p.target_close_date ? new Date(p.target_close_date).toLocaleDateString("en-GB") : "-"}</div></div>
    </div>
    <h2>Purpose</h2><p>${escape(p.funding_purpose)}</p>
    <h2>Growth</h2><p>${escape(p.growth_summary)}</p>
    <h2>Traction</h2><p>${escape(p.traction_summary)}</p>
    <h2>Market</h2><p>${escape(p.market_summary)}</p>
    <h2>Team</h2><p>${escape(p.team_summary)}</p>
    <p class="disclaimer">${investorDisclaimer}</p>
  `;
  printHtml(`${businessName} - Funding profile`, html);
}

function printDataRoom(items: DataRoomItem[], businessName: string) {
  const grouped = DR_FOLDERS.map(({ key, label }) => ({
    label,
    items: items.filter((i) => i.folder === key && i.status !== "archived"),
  }));
  const html = `
    <div class="brand">Jojan One - Data Room Index</div>
    <h1>${businessName}</h1>
    <p class="meta">Prepared ${new Date().toLocaleDateString("en-GB")}</p>
    ${grouped.map((g) => `
      <h2>${g.label}</h2>
      ${g.items.length === 0 ? "<p>No items.</p>" : `
        <table>
          <tr><th>Title</th><th>Type</th><th>Version</th><th>Status</th><th>Confidentiality</th></tr>
          ${g.items.map((i) => `<tr><td>${escape(i.title)}</td><td>${escape(i.document_type)}</td><td>${escape(i.version)}</td><td>${i.status.replace("_"," ")}</td><td>${i.confidentiality}</td></tr>`).join("")}
        </table>
      `}
    `).join("")}
    <p class="disclaimer">${investorDisclaimer} Jojan One does not claim that any document listed here has been independently reviewed.</p>
  `;
  printHtml(`${businessName} - Data Room Index`, html);
}

function escape(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
