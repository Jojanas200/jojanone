import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Award,
  Plus,
  FileBarChart,
  Sparkles,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Layers,
  Library,
  Edit,
  Copy,
  Trash2,
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
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import {
  SectionHeader,
  ReadinessScoreCard,
  tenderStatusTone,
  responseStatusTone,
  InfoRow,
  formatCurrency,
  printHtml,
  tenderDisclaimer,
} from "@/components/growth/shared";
import {
  useCoreData,
  upsertTenderOpportunity,
  newOpportunityDraft,
  setOpportunityStatus,
  deleteOpportunity,
  duplicateOpportunity,
  saveBidAssessment,
  newBidAssessmentDraft,
  upsertTenderRequirement,
  newTenderRequirementDraft,
  deleteTenderRequirement,
  upsertTenderResponse,
  newTenderResponseDraft,
  duplicateTenderResponse,
  upsertEvidenceLibraryItem,
  archiveEvidenceItem,
  newEvidenceItemDraft,
  addReport,
  createConversation,
  appendMessage,
} from "@/data/store";
import {
  tenderReadinessMetrics,
  submissionChecklistItems,
  reqTypeLabel,
  reqStatusLabel,
} from "@/data/growth-selectors";
import { formatDate } from "@/data/selectors";
import type {
  TenderOpportunity,
  TenderRequirement,
  TenderResponse,
  BidAssessment,
  EvidenceLibraryItem,
  EvidenceCategory,
  TenderReqType,
  TenderReqStatus,
  TenderStatus,
  TenderProcedure,
} from "@/data/types";

export const Route = createFileRoute("/tender-ready")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    o: typeof s.o === "string" ? s.o : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tender Ready - Jojan One" },
      { name: "description", content: "Tender and procurement readiness, always current." },
    ],
  }),
  component: TenderReadyPage,
});

const TENDER_STATUSES: TenderStatus[] = ["identified", "assessing", "bid", "no_bid", "drafting", "review", "submitted", "won", "lost", "archived"];
const EVIDENCE_CATEGORIES: EvidenceCategory[] = ["corporate", "financial", "insurance", "policies", "compliance", "data_protection", "cyber_security", "health_safety", "equality", "business_continuity", "environmental", "social_value", "experience", "references", "certifications"];

function TenderReadyPage() {
  const state = useCoreData((s) => s);
  const { o } = Route.useSearch();
  const navigate = useNavigate();
  const metrics = useMemo(() => tenderReadinessMetrics(state), [state]);

  const [oppOpen, setOppOpen] = useState<TenderOpportunity | null>(null);
  const [oppAdd, setOppAdd] = useState(false);
  const [bidFor, setBidFor] = useState<TenderOpportunity | null>(null);
  const [reqFor, setReqFor] = useState<TenderRequirement | null>(null);
  const [reqAddFor, setReqAddFor] = useState<string | null>(null);
  const [respFor, setRespFor] = useState<TenderResponse | null>(null);
  const [respAddFor, setRespAddFor] = useState<{ oppId: string; reqId: string } | null>(null);
  const [evAdd, setEvAdd] = useState(false);
  const [evOpen, setEvOpen] = useState<EvidenceLibraryItem | null>(null);
  const [assessOpen, setAssessOpen] = useState(false);
  const [confirmDelOpp, setConfirmDelOpp] = useState<string | null>(null);
  const [confirmDelReq, setConfirmDelReq] = useState<string | null>(null);
  const [oppSearch, setOppSearch] = useState("");
  const [oppStatusFilter, setOppStatusFilter] = useState<"all" | TenderStatus>("all");
  const [reportPreview, setReportPreview] = useState<string | null>(null);

  useEffect(() => {
    if (o) {
      const opp = state.tender_opportunities.find((x) => x.id === o);
      if (opp) setOppOpen(opp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOpps = useMemo(() => {
    const q = oppSearch.trim().toLowerCase();
    return metrics.opportunities.filter((op) => {
      if (q && !op.title.toLowerCase().includes(q) && !op.authority.toLowerCase().includes(q)) return false;
      if (oppStatusFilter !== "all" && op.status !== oppStatusFilter) return false;
      return true;
    });
  }, [metrics.opportunities, oppSearch, oppStatusFilter]);

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

  const generateReport = () => {
    const id = addReport({
      report_type: "executive_summary",
      title: `Tender Readiness Report - ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
      reporting_period: "Point in time",
      summary: `Tender Readiness ${metrics.readinessScore}/100. ${metrics.active.length} active opportunities, ${metrics.upcomingDeadlines.length} submission deadlines in 30 days.`,
      metrics: [
        { label: "Readiness score", value: `${metrics.readinessScore}/100` },
        { label: "Active opportunities", value: String(metrics.active.length) },
        { label: "Bid decisions pending", value: String(metrics.bidPending.length) },
        { label: "Deadlines <=30d", value: String(metrics.upcomingDeadlines.length) },
        { label: "Requirements incomplete", value: String(metrics.requirementsIncomplete.length) },
        { label: "Evidence items current", value: String(state.evidence_library_items.filter((e) => e.status === "current").length) },
      ],
      findings: [
        `${metrics.evidenceMissing.length} requirement(s) awaiting evidence.`,
        `${metrics.responsesForReview.length} response(s) awaiting review.`,
        !metrics.insuranceOk ? "Insurance evidence not current." : "",
        !metrics.gdprOk ? "GDPR position below tender readiness threshold." : "",
      ].filter(Boolean),
      priority_actions: metrics.requirementsIncomplete.slice(0, 6).map((r) => `Close: ${r.title}`),
      sections: [
        { heading: "Opportunities", body: `${metrics.opportunities.length} tracked, ${metrics.active.length} active, ${metrics.submitted.length} submitted or completed.` },
        { heading: "Evidence and policies", body: `Policy score ${metrics.policyScore}/100; evidence score ${metrics.evidenceScore}/100.` },
        { heading: "Bid risks", body: metrics.active.map((o) => o.title).join(", ") || "No active bids." },
      ],
      source_modules: ["governance", "contracts", "hr", "compliance", "gdpr"],
    });
    setReportPreview(id);
    toast.success("Tender Readiness Report generated");
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <Award className="h-6 w-6 text-primary" /> Tender Ready
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            Assess readiness, track opportunities, make structured bid/no-bid decisions, and manage submissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAssessOpen(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Run readiness assessment
          </Button>
          <Button onClick={generateReport}>
            <FileBarChart className="mr-1.5 h-4 w-4" /> Generate report
          </Button>
        </div>
      </div>

      <p className="mt-3 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-3 py-2 text-[12px] text-muted-foreground">
        {tenderDisclaimer} Opportunities in this prototype are manually entered or demonstration records. Jojan One is not currently connected to live tender portals.
      </p>

      {/* Overview */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <ReadinessScoreCard score={metrics.readinessScore} label="Tender Readiness Score" hint={`Policies ${metrics.policyScore} · Evidence ${metrics.evidenceScore}`} />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Active opportunities" value={metrics.active.length} icon={ClipboardList} />
          <MetricCard label="Bid pending" value={metrics.bidPending.length} tone={metrics.bidPending.length > 0 ? "warning" : "default"} />
          <MetricCard label="Deadlines ≤30d" value={metrics.upcomingDeadlines.length} tone={metrics.upcomingDeadlines.length > 0 ? "warning" : "default"} icon={AlertTriangle} />
          <MetricCard label="Requirements incomplete" value={metrics.requirementsIncomplete.length} />
          <MetricCard label="Evidence missing" value={metrics.evidenceMissing.length} tone={metrics.evidenceMissing.length > 0 ? "warning" : "default"} />
          <MetricCard label="Responses to review" value={metrics.responsesForReview.length} />
        </div>
      </div>

      {/* Opportunity tracker */}
      <div className="mt-10">
        <SectionHeader
          title="Opportunity tracker"
          description="Manage every tender you're tracking. Records are manually entered."
          action={
            <Button size="sm" variant="outline" onClick={() => setOppAdd(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add opportunity
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={oppSearch} onChange={(e) => setOppSearch(e.target.value)} placeholder="Search opportunities…" className="pl-9" />
          </div>
          <Select value={oppStatusFilter} onValueChange={(v) => setOppStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TENDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-2">
          {filteredOpps.length === 0 ? (
            <EmptyState title="No opportunities" description="Add an opportunity or adjust filters." />
          ) : (
            filteredOpps.map((op) => (
              <Card key={op.id} className="flex flex-wrap items-center gap-3 border border-border bg-card p-4 shadow-none">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-foreground">{op.title}</p>
                    <StatusPill tone={tenderStatusTone(op.status)}>{op.status.replace("_", " ")}</StatusPill>
                    <span className="text-[11px] text-muted-foreground">{op.authority}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Value {formatCurrency(op.contract_value, op.currency)} · Deadline {op.submission_deadline ? formatDate(op.submission_deadline) : "-"} · {op.procedure_type}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {op.status === "assessing" && (
                    <Button size="sm" onClick={() => setBidFor(op)}>Bid/No-Bid</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setOppOpen(op)}>Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => askJova(`Should we consider bidding for ${op.title}?`, "tender_opportunity", op.id)}>
                    Ask Jova
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Evidence Library */}
      <div className="mt-10">
        <SectionHeader
          title="Evidence Library"
          description="Reusable evidence linked from your Governance, Compliance, Contracts and HR records."
          action={
            <Button size="sm" variant="outline" onClick={() => setEvAdd(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add evidence
            </Button>
          }
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {EVIDENCE_CATEGORIES.map((cat) => {
            const items = state.evidence_library_items.filter((e) => e.category === cat && e.status !== "archived");
            if (items.length === 0) return null;
            return (
              <Card key={cat} className="flex flex-col gap-2 border border-border bg-card p-4 shadow-none">
                <div className="flex items-center gap-2">
                  <Library className="h-4 w-4 text-primary" />
                  <p className="text-[13px] font-semibold text-foreground capitalize">{cat.replace("_", " ")}</p>
                </div>
                <div className="space-y-1">
                  {items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setEvOpen(i)}
                      className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-[12px] hover:bg-accent"
                    >
                      <span className="truncate">{i.title}</span>
                      <StatusPill tone={i.status === "current" ? "success" : i.status === "in_review" ? "warning" : "neutral"}>{i.status.replace("_", " ")}</StatusPill>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

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

      {/* Opportunity dialog (view/edit) */}
      <OpportunityDialog
        opp={oppOpen}
        add={oppAdd}
        onOpenChange={(v) => { if (!v) { setOppOpen(null); setOppAdd(false); } }}
        state={state}
        onSave={(op) => { upsertTenderOpportunity(op); setOppOpen(null); setOppAdd(false); toast.success("Opportunity saved"); }}
        onDuplicate={(id) => { const nid = duplicateOpportunity(id); if (nid) toast.success("Duplicated"); }}
        onDelete={(id) => setConfirmDelOpp(id)}
        onStartBid={(op) => setBidFor(op)}
        onEditRequirement={(r) => setReqFor(r)}
        onAddRequirement={(oppId) => setReqAddFor(oppId)}
        onDeleteRequirement={(id) => setConfirmDelReq(id)}
        onOpenResponse={(r) => setRespFor(r)}
        onAddResponse={(oppId, reqId) => setRespAddFor({ oppId, reqId })}
        onSetStatus={setOpportunityStatus}
        onAskJova={askJova}
        onPrint={(op) => printOpportunity(op, state)}
      />

      {/* Bid/No-Bid assessment */}
      <BidAssessmentDialog
        open={!!bidFor}
        opp={bidFor}
        existing={bidFor ? state.bid_assessments.find((b) => b.opportunity_id === bidFor.id) ?? null : null}
        onOpenChange={(v) => !v && setBidFor(null)}
        onSubmit={(assessment, decision, reason) => {
          const final = { ...assessment, decision, decision_reason: reason, completed_at: new Date().toISOString() };
          saveBidAssessment(final);
          if (bidFor) setOpportunityStatus(bidFor.id, decision === "bid" ? "bid" : "no_bid", reason);
          setBidFor(null);
          toast.success(decision === "bid" ? "Bid decision recorded" : "No Bid recorded");
        }}
      />

      {/* Requirement dialog */}
      <RequirementDialog
        req={reqFor}
        addFor={reqAddFor}
        onOpenChange={(v) => { if (!v) { setReqFor(null); setReqAddFor(null); } }}
        onSave={(r) => { upsertTenderRequirement(r); setReqFor(null); setReqAddFor(null); toast.success("Requirement saved"); }}
        onLinkEvidence={(r, ev) => { upsertTenderRequirement({ ...r, evidence_reference: ev.title, status: r.status === "evidence_missing" ? "in_progress" : r.status }); toast.success("Evidence linked"); }}
        evidenceItems={state.evidence_library_items}
      />

      {/* Response editor */}
      <ResponseDialog
        resp={respFor}
        addFor={respAddFor}
        onOpenChange={(v) => { if (!v) { setRespFor(null); setRespAddFor(null); } }}
        onSave={(r) => { upsertTenderResponse(r); setRespFor(null); setRespAddFor(null); toast.success("Response saved"); }}
        onDuplicate={(id) => { const nid = duplicateTenderResponse(id); if (nid) toast.success("New version created"); }}
      />

      {/* Evidence dialog */}
      <EvidenceDialog
        item={evOpen}
        add={evAdd}
        onOpenChange={(v) => { if (!v) { setEvOpen(null); setEvAdd(false); } }}
        onSave={(e) => { upsertEvidenceLibraryItem(e); setEvOpen(null); setEvAdd(false); toast.success("Evidence saved"); }}
        onArchive={(id) => { archiveEvidenceItem(id); setEvOpen(null); toast.success("Archived"); }}
      />

      {/* Tender readiness assessment */}
      <TenderReadinessAssessmentDialog open={assessOpen} onOpenChange={setAssessOpen} metrics={metrics} />

      <ConfirmDialog
        open={!!confirmDelOpp}
        onOpenChange={(v) => !v && setConfirmDelOpp(null)}
        title="Delete opportunity?"
        description="This removes the opportunity and all linked requirements, responses and assessments."
        destructive
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDelOpp) deleteOpportunity(confirmDelOpp); setConfirmDelOpp(null); setOppOpen(null); }}
      />
      <ConfirmDialog
        open={!!confirmDelReq}
        onOpenChange={(v) => !v && setConfirmDelReq(null)}
        title="Delete requirement?"
        destructive
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDelReq) deleteTenderRequirement(confirmDelReq); setConfirmDelReq(null); }}
      />
    </div>
  );
}

// ---------- Opportunity dialog ----------
function OpportunityDialog(props: {
  opp: TenderOpportunity | null;
  add: boolean;
  onOpenChange: (v: boolean) => void;
  state: any;
  onSave: (o: TenderOpportunity) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onStartBid: (o: TenderOpportunity) => void;
  onEditRequirement: (r: TenderRequirement) => void;
  onAddRequirement: (oppId: string) => void;
  onDeleteRequirement: (id: string) => void;
  onOpenResponse: (r: TenderResponse) => void;
  onAddResponse: (oppId: string, reqId: string) => void;
  onSetStatus: (id: string, s: TenderStatus, reason?: string) => void;
  onAskJova: (q: string, refType?: string, refId?: string) => void;
  onPrint: (o: TenderOpportunity) => void;
}) {
  const { opp, add, onOpenChange, state, onSave, onDuplicate, onDelete, onStartBid,
    onEditRequirement, onAddRequirement, onDeleteRequirement, onOpenResponse, onAddResponse,
    onSetStatus, onAskJova, onPrint } = props;
  const open = !!opp || add;
  const [draft, setDraft] = useState<TenderOpportunity>(opp ?? newOpportunityDraft());
  const [tab, setTab] = useState<"details" | "requirements" | "checklist">("details");
  useEffect(() => { setDraft(opp ?? newOpportunityDraft()); setTab("details"); }, [opp, add]);
  if (!open) return null;

  const reqs: TenderRequirement[] = opp ? state.tender_requirements.filter((r: TenderRequirement) => r.opportunity_id === opp.id) : [];
  const responses: TenderResponse[] = opp ? state.tender_responses.filter((r: TenderResponse) => r.opportunity_id === opp.id) : [];
  const checklist = opp ? submissionChecklistItems(state, opp.id) : [];
  const mandatoryReady = checklist.filter((c) => c.mandatory).every((c) => c.done);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{opp ? draft.title || "Opportunity" : "Add opportunity"}</DialogTitle>
          {opp && <DialogDescription>{draft.authority} · {draft.reference}</DialogDescription>}
        </DialogHeader>
        {opp && (
          <div className="flex gap-1 border-b border-border">
            {(["details", "requirements", "checklist"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-[13px] capitalize ${tab === t ? "border-b-2 border-primary font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {(!opp || tab === "details") && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <Label>Authority *</Label>
              <Input value={draft.authority} onChange={(e) => setDraft({ ...draft, authority: e.target.value })} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
            </div>
            <div>
              <Label>Sector</Label>
              <Input value={draft.sector} onChange={(e) => setDraft({ ...draft, sector: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <div>
              <Label>Contract value ({draft.currency})</Label>
              <Input type="number" value={draft.contract_value} onChange={(e) => setDraft({ ...draft, contract_value: Number(e.target.value || 0) })} />
            </div>
            <div>
              <Label>Contract duration</Label>
              <Input value={draft.contract_duration} onChange={(e) => setDraft({ ...draft, contract_duration: e.target.value })} />
            </div>
            <div>
              <Label>Publication date</Label>
              <Input type="date" value={draft.publication_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, publication_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <Label>Clarification deadline</Label>
              <Input type="date" value={draft.clarification_deadline?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, clarification_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <Label>Submission deadline *</Label>
              <Input type="date" value={draft.submission_deadline?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, submission_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <Label>Contract start</Label>
              <Input type="date" value={draft.contract_start_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, contract_start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <Label>Procedure type</Label>
              <Select value={draft.procedure_type} onValueChange={(v) => setDraft({ ...draft, procedure_type: v as TenderProcedure })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="framework">Framework</SelectItem>
                  <SelectItem value="direct_award">Direct award</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as TenderStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TENDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
            </div>
            <div>
              <Label>Owner</Label>
              <Input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Eligibility notes</Label>
              <Textarea rows={2} value={draft.eligibility_notes} onChange={(e) => setDraft({ ...draft, eligibility_notes: e.target.value })} />
            </div>
          </div>
        )}

        {opp && tab === "requirements" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">{reqs.length} requirements</p>
              <Button size="sm" variant="outline" onClick={() => onAddRequirement(opp.id)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add requirement
              </Button>
            </div>
            {reqs.length === 0 ? (
              <EmptyState title="No requirements" description="Add the requirements this tender lists." />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-[12px]">
                  <thead className="bg-[oklch(0.98_0.003_260)] text-left text-muted-foreground">
                    <tr>
                      <th className="p-2">Requirement</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Mand.</th>
                      <th className="p-2">Weight</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Evidence</th>
                      <th className="p-2">Response</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reqs.map((r) => {
                      const resp = responses.find((x) => x.id === r.response_id) ?? responses.find((x) => x.requirement_id === r.id);
                      return (
                        <tr key={r.id} className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">{r.title}</td>
                          <td className="p-2 text-muted-foreground">{reqTypeLabel(r.requirement_type)}</td>
                          <td className="p-2">{r.mandatory ? "Yes" : "No"}</td>
                          <td className="p-2">{r.weighting}</td>
                          <td className="p-2">
                            <StatusPill tone={r.status === "complete" ? "success" : r.status === "not_applicable" ? "neutral" : r.status === "evidence_missing" ? "danger" : r.status === "ready_for_review" ? "warning" : "info"}>
                              {reqStatusLabel(r.status)}
                            </StatusPill>
                          </td>
                          <td className="p-2 text-muted-foreground">{r.evidence_reference || "-"}</td>
                          <td className="p-2">
                            {resp ? (
                              <button type="button" className="text-primary hover:underline" onClick={() => onOpenResponse(resp)}>
                                {resp.status.replace("_", " ")}
                              </button>
                            ) : (
                              <button type="button" className="text-primary hover:underline" onClick={() => onAddResponse(opp.id, r.id)}>
                                + Draft
                              </button>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => onEditRequirement(r)}><Edit className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => onDeleteRequirement(r.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {opp && tab === "checklist" && (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              Complete every mandatory item before marking ready to submit. The platform records readiness; it does not submit the tender externally.
            </p>
            {checklist.map((c) => (
              <div key={c.id} className={`flex items-start gap-2 rounded-md border border-border bg-card p-3 text-[13px] ${c.done ? "" : c.mandatory ? "border-[oklch(0.9_0.05_25)]" : ""}`}>
                <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border ${c.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c.done && "✓"}</span>
                <span className="flex-1">{c.label}{c.mandatory && <span className="ml-1 text-[10px] uppercase text-muted-foreground">mandatory</span>}</span>
              </div>
            ))}
            <Button
              className="mt-2 w-full"
              disabled={!mandatoryReady}
              onClick={() => { onSetStatus(opp.id, "submitted", "Submission recorded"); onOpenChange(false); toast.success("Marked ready to submit"); }}
            >
              {mandatoryReady ? "Mark ready to submit" : "Mandatory items incomplete"}
            </Button>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {opp && <Button variant="ghost" onClick={() => onPrint(opp)}><Printer className="mr-1.5 h-3.5 w-3.5" /> Print summary</Button>}
          {opp && <Button variant="ghost" onClick={() => onAskJova(`Explain this tender opportunity: ${opp.title}`, "tender_opportunity", opp.id)}><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova</Button>}
          {opp && draft.status === "assessing" && <Button variant="outline" onClick={() => onStartBid(opp)}>Start Bid/No-Bid</Button>}
          {opp && <Button variant="ghost" onClick={() => onDuplicate(opp.id)}><Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate</Button>}
          {opp && <Button variant="ghost" className="text-destructive" onClick={() => onDelete(opp.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete</Button>}
          <Button disabled={!draft.title || !draft.authority || !draft.submission_deadline} onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Bid Assessment ----------
const BID_QUESTIONS = [
  { id: "fit", label: "Strategic fit", field: "strategic_fit_score" },
  { id: "elig", label: "Mandatory eligibility met", field: "eligibility_score" },
  { id: "capacity", label: "Delivery capacity / resource", field: "capacity_score" },
  { id: "evidence", label: "Evidence readiness", field: "evidence_score" },
  { id: "commercial", label: "Commercial attractiveness", field: "commercial_score" },
  { id: "risk", label: "Delivery risk (higher = safer)", field: "delivery_risk_score" },
] as const;

function BidAssessmentDialog({ open, opp, existing, onOpenChange, onSubmit }: {
  open: boolean;
  opp: TenderOpportunity | null;
  existing: BidAssessment | null;
  onOpenChange: (v: boolean) => void;
  onSubmit: (a: BidAssessment, decision: "bid" | "no_bid", reason: string) => void;
}) {
  const [draft, setDraft] = useState<BidAssessment | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (opp) {
      const base = existing ?? newBidAssessmentDraft(opp.id);
      setDraft(base);
      setReason(existing?.decision_reason ?? "");
    }
  }, [opp, existing]);
  if (!opp || !draft) return null;

  const overall = Math.round(
    (draft.strategic_fit_score + draft.eligibility_score + draft.capacity_score + draft.evidence_score + draft.commercial_score + draft.delivery_risk_score) / 6,
  );
  const recommendation: "bid" | "no_bid" | "conditional" = overall >= 70 && draft.eligibility_score >= 60 ? "bid" : overall < 50 || draft.eligibility_score < 40 ? "no_bid" : "conditional";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bid / No-Bid assessment</DialogTitle>
          <DialogDescription>{opp.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {BID_QUESTIONS.map((q) => (
            <div key={q.id} className="rounded-md border border-border p-3">
              <div className="mb-1 flex items-center justify-between text-[13px]">
                <span className="font-medium">{q.label}</span>
                <span className="text-muted-foreground">{(draft as any)[q.field]}/100</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={(draft as any)[q.field]}
                onChange={(e) => setDraft({ ...draft, [q.field]: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <div className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold">Overall suitability</span>
            <span className="text-[16px] font-semibold">{overall}/100</span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Advisory recommendation: <strong className="capitalize">{recommendation.replace("_", " ")}</strong>. The final Bid / No Bid decision is yours to make.
          </p>
        </div>
        <div>
          <Label>Decision reason *</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Record the reason for your decision." />
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Return to assessment</Button>
          <Button variant="outline" disabled={!reason.trim()} onClick={() => onSubmit({ ...draft, strategic_fit_score: draft.strategic_fit_score, overall_score: overall, recommendation }, "no_bid", reason)}>
            Record No Bid
          </Button>
          <Button disabled={!reason.trim()} onClick={() => onSubmit({ ...draft, overall_score: overall, recommendation }, "bid", reason)}>
            Proceed with Bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Requirement dialog ----------
function RequirementDialog({ req, addFor, onOpenChange, onSave, onLinkEvidence, evidenceItems }: {
  req: TenderRequirement | null;
  addFor: string | null;
  onOpenChange: (v: boolean) => void;
  onSave: (r: TenderRequirement) => void;
  onLinkEvidence: (r: TenderRequirement, e: EvidenceLibraryItem) => void;
  evidenceItems: EvidenceLibraryItem[];
}) {
  const open = !!req || !!addFor;
  const [draft, setDraft] = useState<TenderRequirement | null>(null);
  useEffect(() => {
    if (req) setDraft(req);
    else if (addFor) setDraft(newTenderRequirementDraft(addFor));
  }, [req, addFor]);
  if (!open || !draft) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{req ? "Edit requirement" : "Add requirement"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title *</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={draft.requirement_type} onValueChange={(v) => setDraft({ ...draft, requirement_type: v as TenderReqType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["eligibility","pass_fail","technical","quality","commercial","social_value","legal","submission"] as TenderReqType[]).map((t) => (
                  <SelectItem key={t} value={t}>{reqTypeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as TenderReqStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["not_started","in_progress","evidence_missing","ready_for_review","complete","not_applicable"] as TenderReqStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{reqStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mandatory</Label>
            <Select value={draft.mandatory ? "yes" : "no"} onValueChange={(v) => setDraft({ ...draft, mandatory: v === "yes" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Weighting</Label>
            <Input type="number" value={draft.weighting} onChange={(e) => setDraft({ ...draft, weighting: Number(e.target.value || 0) })} />
          </div>
          <div>
            <Label>Owner</Label>
            <Input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={draft.due_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Evidence reference</Label>
            <Input value={draft.evidence_reference} onChange={(e) => setDraft({ ...draft, evidence_reference: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Link evidence from library</Label>
            <Select value="" onValueChange={(v) => {
              const ev = evidenceItems.find((e) => e.id === v);
              if (ev) { onLinkEvidence(draft, ev); setDraft({ ...draft, evidence_reference: ev.title }); }
            }}>
              <SelectTrigger><SelectValue placeholder="Choose evidence…" /></SelectTrigger>
              <SelectContent>
                {evidenceItems.filter((e) => e.status === "current").map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.category} · {e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!draft.title} onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Response dialog ----------
function ResponseDialog({ resp, addFor, onOpenChange, onSave, onDuplicate }: {
  resp: TenderResponse | null;
  addFor: { oppId: string; reqId: string } | null;
  onOpenChange: (v: boolean) => void;
  onSave: (r: TenderResponse) => void;
  onDuplicate: (id: string) => void;
}) {
  const open = !!resp || !!addFor;
  const [draft, setDraft] = useState<TenderResponse | null>(null);
  useEffect(() => {
    if (resp) setDraft(resp);
    else if (addFor) setDraft(newTenderResponseDraft(addFor.oppId, addFor.reqId));
  }, [resp, addFor]);
  if (!open || !draft) return null;
  const wordCount = draft.response_text.split(/\s+/).filter(Boolean).length;
  const overLimit = draft.word_limit > 0 && wordCount > draft.word_limit;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resp ? "Edit response" : "New response"}</DialogTitle>
          <DialogDescription>Structured mock guidance only - Jojan One does not automatically generate invented experience, statistics, accreditations or references.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Section title</Label>
            <Input value={draft.section_title} onChange={(e) => setDraft({ ...draft, section_title: e.target.value })} />
          </div>
          <div>
            <Label>Question</Label>
            <Textarea rows={2} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Word limit</Label>
              <Input type="number" value={draft.word_limit} onChange={(e) => setDraft({ ...draft, word_limit: Number(e.target.value || 0) })} />
            </div>
            <div className="flex-1">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="ready_for_review">Ready for review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Response text</Label>
              <span className={`text-[11px] ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>{wordCount}{draft.word_limit ? ` / ${draft.word_limit}` : ""} words</span>
            </div>
            <Textarea rows={10} value={draft.response_text} onChange={(e) => setDraft({ ...draft, response_text: e.target.value })} />
          </div>
          <div>
            <Label>Review notes</Label>
            <Textarea rows={2} value={draft.review_notes} onChange={(e) => setDraft({ ...draft, review_notes: e.target.value })} />
          </div>
          <div className="text-[11px] text-muted-foreground">Version {draft.version} · Owner {draft.owner}</div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {resp && <Button variant="ghost" onClick={() => onDuplicate(resp.id)}><Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate as new version</Button>}
          {resp && <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(draft.response_text); toast.success("Copied"); }}>Copy</Button>}
          {resp && <Button variant="ghost" onClick={() => printHtml(draft.section_title, `<h1>${draft.section_title}</h1><p><em>${draft.question}</em></p><pre style="white-space:pre-wrap;font-family:inherit">${draft.response_text.replace(/</g, "&lt;")}</pre>`)}><Printer className="mr-1.5 h-3.5 w-3.5" /> Print</Button>}
          {draft.status !== "approved" && <Button variant="outline" onClick={() => onSave({ ...draft, status: "ready_for_review" })}>Mark ready for review</Button>}
          {draft.status === "ready_for_review" && <Button variant="outline" onClick={() => onSave({ ...draft, status: "approved" })}>Approve</Button>}
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Evidence dialog ----------
function EvidenceDialog({ item, add, onOpenChange, onSave, onArchive }: {
  item: EvidenceLibraryItem | null;
  add: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (e: EvidenceLibraryItem) => void;
  onArchive: (id: string) => void;
}) {
  const open = !!item || add;
  const [draft, setDraft] = useState<EvidenceLibraryItem>(item ?? newEvidenceItemDraft());
  useEffect(() => { setDraft(item ?? newEvidenceItemDraft()); }, [item, add]);
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit evidence" : "Add evidence"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title *</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as EvidenceCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVIDENCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="in_review">In review</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <Label>File name</Label>
            <Input value={draft.file_name} onChange={(e) => setDraft({ ...draft, file_name: e.target.value })} />
          </div>
          <div>
            <Label>Review date</Label>
            <Input type="date" value={draft.review_date?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, review_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {item && item.status !== "archived" && <Button variant="outline" onClick={() => onArchive(item.id)}>Archive</Button>}
          <Button disabled={!draft.title} onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Tender readiness assessment (simple) ----------
function TenderReadinessAssessmentDialog({ open, onOpenChange, metrics }: { open: boolean; onOpenChange: (v: boolean) => void; metrics: ReturnType<typeof tenderReadinessMetrics> }) {
  const gaps: string[] = [];
  if (!metrics.insuranceOk) gaps.push("Insurance evidence not current");
  if (!metrics.gdprOk) gaps.push("GDPR readiness below threshold");
  if (!metrics.complianceOk) gaps.push("Overdue compliance obligations present");
  if (metrics.evidenceScore < 60) gaps.push("Evidence library needs expansion");
  if (metrics.policyScore < 60) gaps.push("Policy coverage needs strengthening");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tender Readiness Assessment</DialogTitle>
          <DialogDescription>Deterministic assessment based on recorded policies, evidence and compliance.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Readiness score" value={`${metrics.readinessScore}/100`} />
          <InfoRow label="Policies" value={`${metrics.policyScore}/100`} />
          <InfoRow label="Evidence" value={`${metrics.evidenceScore}/100`} />
          <InfoRow label="Insurance" value={metrics.insuranceOk ? "Current" : "Attention"} />
          <InfoRow label="GDPR" value={metrics.gdprOk ? "OK" : "Below threshold"} />
          <InfoRow label="Compliance" value={metrics.complianceOk ? "On track" : "Overdue items"} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">Gaps and next steps</p>
          {gaps.length === 0 ? (
            <p className="mt-1 text-[12px] text-muted-foreground">No material gaps recorded.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 text-[12px] text-foreground">
              {gaps.map((g) => <li key={g}>{g}</li>)}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Print helpers ----------
function printOpportunity(op: TenderOpportunity, state: any) {
  const reqs: TenderRequirement[] = state.tender_requirements.filter((r: TenderRequirement) => r.opportunity_id === op.id);
  const html = `
    <div class="brand">Jojan One - Tender opportunity</div>
    <h1>${escape(op.title)}</h1>
    <p class="meta">${escape(op.authority)} · Ref ${escape(op.reference)}</p>
    <div class="grid">
      <div class="metric"><div class="l">Value</div><div class="v">${op.currency} ${op.contract_value.toLocaleString()}</div></div>
      <div class="metric"><div class="l">Deadline</div><div class="v">${op.submission_deadline ? new Date(op.submission_deadline).toLocaleDateString("en-GB") : "-"}</div></div>
      <div class="metric"><div class="l">Status</div><div class="v">${op.status.replace("_"," ")}</div></div>
      <div class="metric"><div class="l">Procedure</div><div class="v">${op.procedure_type}</div></div>
    </div>
    <h2>Summary</h2><p>${escape(op.summary)}</p>
    <h2>Eligibility</h2><p>${escape(op.eligibility_notes)}</p>
    <h2>Requirements (${reqs.length})</h2>
    <table><tr><th>Title</th><th>Type</th><th>Mand.</th><th>Weight</th><th>Status</th></tr>
      ${reqs.map((r) => `<tr><td>${escape(r.title)}</td><td>${reqTypeLabel(r.requirement_type)}</td><td>${r.mandatory?"Yes":"No"}</td><td>${r.weighting}</td><td>${reqStatusLabel(r.status)}</td></tr>`).join("")}
    </table>
    <p class="disclaimer">${tenderDisclaimer}</p>
  `;
  printHtml(op.title, html);
}

function escape(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
