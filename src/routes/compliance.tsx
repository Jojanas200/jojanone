import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  upsertObligation,
  completeObligation,
  reopenObligation,
  markObligationNotApplicable,
  newObligationDraft,
  addEvidence,
  newEvidenceDraft,
  createConversation,
  appendMessage,
} from "@/data/store";
import { obligationMetrics } from "@/data/cg-selectors";
import { formatDate } from "@/data/selectors";
import type { ComplianceObligation, ComplianceEvidence } from "@/data/types";
import {
  Button, Card, Field, Input, Textarea, SectionHeader, InfoRow, DateStatusBadge,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/business/shared";
import { MetricCard } from "@/components/core/MetricCard";
import { EmptyState } from "@/components/core/EmptyState";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Plus, Pencil, Check, MessageSquare, Printer, RotateCcw, FileText, Ban, Info } from "lucide-react";
import { toast } from "sonner";
import { ApplicabilityBadge, ObligationStatusPill } from "@/components/cg/shared";

export const Route = createFileRoute("/compliance")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ o: typeof s.o === "string" ? s.o : undefined }),
  head: () => ({
    meta: [
      { title: "Compliance - Jojan One" },
      { name: "description", content: "UK compliance workspace: obligations, evidence and calendar." },
    ],
  }),
  component: CompliancePage,
});

const CATEGORIES = [
  ["companies_house", "Companies House"], ["tax", "Tax"], ["vat", "VAT"], ["payroll", "Payroll"],
  ["pensions", "Pensions"], ["insurance", "Insurance (statutory)"], ["employment", "Employment"],
  ["data_protection", "Data protection"], ["health_safety", "Health & Safety"],
  ["insurance_business", "Business insurance"], ["governance", "Governance"], ["other", "Other"],
] as const;

function CompliancePage() {
  const state = useCoreData((s) => s);
  const nav = useNavigate();
  const { o: openO } = Route.useSearch();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [catF, setCatF] = useState("all");
  const [regF, setRegF] = useState("all");
  const [priF, setPriF] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(openO ?? null);
  const [form, setForm] = useState<ComplianceObligation | null>(null);
  const [naFor, setNaFor] = useState<string | null>(null);
  const [naReason, setNaReason] = useState("");
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState<ComplianceEvidence | null>(null);
  const [assessOpen, setAssessOpen] = useState(false);

  const m = obligationMetrics(state);
  const detail = state.compliance_obligations.find((o) => o.id === detailId) ?? null;
  const regulators = Array.from(new Set(state.compliance_obligations.map((o) => o.regulator))).filter(Boolean);

  const filtered = useMemo(() => {
    return state.compliance_obligations.filter((o) => {
      if (tab === "action") return o.status === "action_required" || o.status === "overdue";
      if (tab === "overdue") return o.status === "overdue" || (o.due_date && new Date(o.due_date).getTime() < Date.now() && o.status !== "completed");
      if (tab === "upcoming") return m.due30.includes(o);
      if (tab === "evidence") return o.evidence_status !== "complete" && o.status !== "completed" && o.applicability_status === "applicable";
      if (tab === "completed") return o.status === "completed";
      if (tab === "na") return o.applicability_status === "not_applicable";
      return true;
    }).filter((o) => (catF === "all" ? true : o.category === catF))
      .filter((o) => (regF === "all" ? true : o.regulator === regF))
      .filter((o) => (priF === "all" ? true : o.priority === priF))
      .filter((o) => (q ? (o.title + o.description + o.regulator).toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }, [state.compliance_obligations, tab, catF, regF, priF, q, m.due30]);

  const askJovaAbout = (o: ComplianceObligation) => {
    const cid = createConversation(`Compliance: ${o.title}`);
    appendMessage({ conversation_id: cid, sender: "user", content: `Explain ${o.title}`, reference_type: "obligation", reference_id: o.id, suggested_action: null });
    nav({ to: "/jova", search: { c: cid } });
  };

  const printObligation = (o: ComplianceObligation) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${o.title}</title><style>body{font-family:system-ui;padding:2rem;max-width:720px}h1{margin-bottom:.25rem}dt{font-weight:600;margin-top:.5rem}dd{margin:0}</style></head><body>
      <h1>${o.title}</h1><p><strong>${o.regulator}</strong> - ${o.jurisdiction}</p>
      <dl><dt>Status</dt><dd>${o.status}</dd><dt>Due</dt><dd>${o.due_date ?? "-"}</dd>
      <dt>Why it applies</dt><dd>${o.reason_applies}</dd>
      <dt>Explanation</dt><dd>${o.plain_language_explanation}</dd>
      <dt>Required action</dt><dd>${o.required_action}</dd>
      <dt>Required evidence</dt><dd>${o.required_evidence.join("; ") || "-"}</dd>
      <dt>Notes</dt><dd>${o.notes || "-"}</dd></dl>
      <p style="font-size:11px;color:#666;margin-top:2rem">Generated by Jojan One. Not legal advice.</p>
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.75} /> Compliance
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Track every UK obligation from identification to completion. Deterministic mock ruleset for Anastasia & Co Ltd - not live regulatory monitoring.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssessOpen(true)}>Applicability assessment</Button>
          <Button onClick={() => setForm(newObligationDraft())}><Plus className="mr-1 h-4 w-4" />Obligation</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Applicable" value={m.applicable.length} hint="Obligations that apply now" />
        <MetricCard label="Action required" value={m.actionRequired.length} tone={m.actionRequired.length ? "warning" : "default"} />
        <MetricCard label="Overdue" value={m.overdue.length} tone={m.overdue.length ? "danger" : "success"} />
        <MetricCard label="Due 30d" value={m.due30.length} />
        <MetricCard label="Awaiting evidence" value={m.awaitingEvidence.length} />
        <MetricCard label="Completed this month" value={m.completedMonth.length} tone="success" />
        <MetricCard label="Not applicable" value={m.na.length} />
        <MetricCard label="Position" value={m.overdue.length ? "Attention" : m.actionRequired.length ? "Minor gaps" : "On track"} tone={m.overdue.length ? "danger" : m.actionRequired.length ? "warning" : "success"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="action">Action Required</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="evidence">Awaiting Evidence</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="na">Not Applicable</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search obligations…" className="flex-1 min-w-[220px]" />
        <Select value={catF} onValueChange={setCatF}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={regF} onValueChange={setRegF}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Regulator" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All regulators</SelectItem>{regulators.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={priF} onValueChange={setPriF}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Any priority</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCatF("all"); setRegF("all"); setPriF("all"); }}>Clear</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No obligations match" description="Try clearing filters or add a new obligation." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[oklch(0.98_0.003_260)] text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3 text-left">Obligation</th><th className="p-3 text-left">Regulator</th><th className="p-3 text-left">Due</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Evidence</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-accent/40">
                  <td className="p-3">
                    <button className="text-left font-medium text-foreground hover:underline" onClick={() => setDetailId(o.id)}>{o.title}</button>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{o.recurrence !== "none" ? `${o.recurrence}` : "one-off"}{o.professional_support_required ? " • professional support" : ""}</div>
                  </td>
                  <td className="p-3">{o.regulator}</td>
                  <td className="p-3"><DateStatusBadge iso={o.due_date} /></td>
                  <td className="p-3"><ObligationStatusPill o={o} /></td>
                  <td className="p-3">{o.evidence_status === "complete" ? "✓ recorded" : o.evidence_status === "in_progress" ? "in progress" : "-"}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setDetailId(o.id)}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailDrawer open={!!detail} onOpenChange={(v) => !v && setDetailId(null)} title={detail?.title ?? ""} description={detail ? `${detail.regulator} - ${detail.jurisdiction}` : ""}>
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <ObligationStatusPill o={detail} />
              <ApplicabilityBadge o={detail} />
              {detail.professional_support_required && <span className="rounded-full bg-[oklch(0.955_0.05_264)] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.45_0.2_264)]">Professional support</span>}
            </div>
            <InfoRow label="Why it applies" value={detail.reason_applies} />
            <InfoRow label="Plain-language explanation" value={detail.plain_language_explanation} />
            <InfoRow label="Required action" value={detail.required_action} />
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Due" value={detail.due_date ? formatDate(detail.due_date) : "-"} />
              <InfoRow label="Recurrence" value={detail.recurrence} />
              <InfoRow label="Owner" value={detail.owner} />
              <InfoRow label="Source" value={detail.source_reference} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Required evidence</p>
              <ul className="mt-1 space-y-1 text-[13px]">
                {detail.required_evidence.map((e, i) => <li key={i}>• {e}</li>)}
                {detail.required_evidence.length === 0 && <li className="text-muted-foreground">None specified.</li>}
              </ul>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recorded evidence</p>
              <ul className="mt-1 space-y-1 text-[13px]">
                {state.compliance_evidence.filter((e) => e.obligation_id === detail.id).map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded border border-border p-2">
                    <span><strong>{e.title}</strong> - {e.reference}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(e.created_at)}</span>
                  </li>
                ))}
                {state.compliance_evidence.filter((e) => e.obligation_id === detail.id).length === 0 && <li className="text-muted-foreground">No evidence recorded.</li>}
              </ul>
            </div>
            {detail.notes && <InfoRow label="Notes" value={detail.notes} />}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {detail.status !== "completed" && detail.applicability_status === "applicable" && (
                <Button size="sm" onClick={() => { completeObligation(detail.id); toast.success("Marked complete."); setDetailId(null); }}><Check className="mr-1 h-3.5 w-3.5" />Mark complete</Button>
              )}
              {detail.status === "completed" && (
                <Button size="sm" variant="outline" onClick={() => { reopenObligation(detail.id); toast.success("Reopened."); }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reopen</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setEvidenceFor(detail.id); setEvidenceDraft(newEvidenceDraft(detail.id)); }}><FileText className="mr-1 h-3.5 w-3.5" />Add evidence</Button>
              <Button size="sm" variant="outline" onClick={() => setForm(detail)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
              {detail.applicability_status !== "not_applicable" && (
                <Button size="sm" variant="ghost" onClick={() => { setNaFor(detail.id); setNaReason(""); }}><Ban className="mr-1 h-3.5 w-3.5" />Mark not applicable</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => askJovaAbout(detail)}><MessageSquare className="mr-1 h-3.5 w-3.5" />Ask Jova</Button>
              <Button size="sm" variant="ghost" onClick={() => printObligation(detail)}><Printer className="mr-1 h-3.5 w-3.5" />Print</Button>
            </div>
            {detail.category === "data_protection" && (
              <Button variant="outline" size="sm" onClick={() => nav({ to: "/gdpr" })}>Open GDPR</Button>
            )}
            <p className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3 text-[12px] text-muted-foreground">
              <Info className="mr-1 inline h-3.5 w-3.5" />Deterministic mock rule set. Not a substitute for professional advice.
            </p>
          </div>
        )}
      </DetailDrawer>

      {/* Edit / new form */}
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{state.compliance_obligations.find((o) => o.id === form?.id) ? "Edit obligation" : "New obligation"}</DialogTitle></DialogHeader>
          {form && (
            <div className="flex flex-col gap-3">
              <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ComplianceObligation["category"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Regulator"><Input value={form.regulator} onChange={(e) => setForm({ ...form, regulator: e.target.value })} /></Field>
                <Field label="Priority">
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as "high" | "medium" | "low" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Due date"><Input type="date" value={form.due_date?.slice(0,10) ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
                <Field label="Recurrence">
                  <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as ComplianceObligation["recurrence"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Owner"><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
              </div>
              <Field label="Why it applies"><Textarea value={form.reason_applies} onChange={(e) => setForm({ ...form, reason_applies: e.target.value })} rows={2} /></Field>
              <Field label="Plain-language explanation"><Textarea value={form.plain_language_explanation} onChange={(e) => setForm({ ...form, plain_language_explanation: e.target.value })} rows={3} /></Field>
              <Field label="Required action"><Textarea value={form.required_action} onChange={(e) => setForm({ ...form, required_action: e.target.value })} rows={2} /></Field>
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => { if (form?.title) { upsertObligation(form); toast.success("Obligation saved."); setForm(null); } else toast.error("Title is required."); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence dialog */}
      <Dialog open={!!evidenceDraft} onOpenChange={(v) => { if (!v) { setEvidenceDraft(null); setEvidenceFor(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record evidence</DialogTitle></DialogHeader>
          {evidenceDraft && (
            <div className="flex flex-col gap-3">
              <Field label="Evidence title" required><Input value={evidenceDraft.title} onChange={(e) => setEvidenceDraft({ ...evidenceDraft, title: e.target.value })} /></Field>
              <Field label="Reference"><Input value={evidenceDraft.reference} onChange={(e) => setEvidenceDraft({ ...evidenceDraft, reference: e.target.value })} /></Field>
              <Field label="File name (metadata only)"><Input value={evidenceDraft.file_name} onChange={(e) => setEvidenceDraft({ ...evidenceDraft, file_name: e.target.value })} /></Field>
              <Field label="Description"><Textarea value={evidenceDraft.description} onChange={(e) => setEvidenceDraft({ ...evidenceDraft, description: e.target.value })} /></Field>
              <p className="text-[11px] text-muted-foreground">Metadata only - files are not uploaded or externally verified.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEvidenceDraft(null); setEvidenceFor(null); }}>Cancel</Button>
            <Button onClick={() => { if (evidenceDraft?.title) { addEvidence(evidenceDraft); toast.success("Evidence recorded."); setEvidenceDraft(null); setEvidenceFor(null); } else toast.error("Title required."); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not applicable */}
      <Dialog open={!!naFor} onOpenChange={(v) => !v && setNaFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as not applicable</DialogTitle></DialogHeader>
          <Textarea value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder="Reason required…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNaFor(null)}>Cancel</Button>
            <Button onClick={() => { if (naFor && naReason.trim()) { markObligationNotApplicable(naFor, naReason.trim()); toast.success("Marked not applicable."); setNaFor(null); setDetailId(null); } else toast.error("Reason required."); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applicability assessment */}
      <ApplicabilityDialog open={assessOpen} onClose={() => setAssessOpen(false)} />

      <p className="text-[11px] text-muted-foreground">
        Jojan One organises obligations using a deterministic UK rule set. It does not perform live regulatory monitoring or provide legal advice.
      </p>
    </div>
  );
}

function ApplicabilityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useCoreData((x) => x);
  const p = s.business_profile;
  const [answers, setAnswers] = useState({
    limited: true,
    vat: p.vat_registered,
    employer: p.employer_registered || p.employee_count > 0,
    employees_ge_5: p.employee_count >= 5,
    pensions: p.employee_count > 0,
    personal_data: p.processes_personal_data,
    international: p.trades_internationally,
    website: true,
    regulated: false,
    suppliers: p.supplier_count > 0,
  });
  const [done, setDone] = useState(false);

  const categoriesApplicable: Array<{ label: string; why: string }> = [];
  if (answers.limited) categoriesApplicable.push({ label: "Companies House filings", why: "You operate a limited company." });
  categoriesApplicable.push({ label: "Corporation Tax", why: "All trading companies file CT600 annually." });
  if (answers.vat) categoriesApplicable.push({ label: "VAT MTD returns", why: "You are VAT-registered." });
  if (answers.employer) categoriesApplicable.push({ label: "PAYE / Employers' Liability / RTW", why: "You employ people." });
  if (answers.pensions) categoriesApplicable.push({ label: "Workplace pension duties", why: "You have staff eligible for pensions duties." });
  if (answers.employees_ge_5) categoriesApplicable.push({ label: "Written H&S policy", why: "Statutory threshold at 5 employees." });
  if (answers.personal_data) categoriesApplicable.push({ label: "GDPR obligations (ICO fee, ROPA, notices)", why: "You process personal data." });
  if (answers.international) categoriesApplicable.push({ label: "International tax / data transfer considerations", why: "You trade internationally." });
  if (answers.website) categoriesApplicable.push({ label: "Website transparency (privacy, cookies, terms)", why: "You run a public website." });
  if (answers.regulated) categoriesApplicable.push({ label: "Sector regulator obligations", why: "You indicated regulated activity." });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Applicability assessment</DialogTitle></DialogHeader>
        {!done ? (
          <div className="grid gap-3">
            {[
              ["limited", "Is the business a UK limited company?"],
              ["vat", "Is the business VAT registered?"],
              ["employer", "Do you employ staff?"],
              ["employees_ge_5", "Do you employ 5 or more people?"],
              ["pensions", "Do you have workplace pension responsibilities?"],
              ["personal_data", "Do you process personal data?"],
              ["international", "Do you trade internationally?"],
              ["website", "Do you operate a public website or online service?"],
              ["regulated", "Do you carry out regulated activities?"],
              ["suppliers", "Do you rely on external suppliers or contractors?"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center justify-between rounded border border-border p-2 text-[13px]">
                <span>{l}</span>
                <input type="checkbox" checked={(answers as Record<string, boolean>)[k as string]} onChange={(e) => setAnswers({ ...answers, [k as string]: e.target.checked })} />
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-[13px]">
            <p className="text-muted-foreground">Based on your answers, these obligation categories likely apply. Jojan One does not make a final legal determination - check with a professional for anything unclear.</p>
            <ul className="space-y-2">
              {categoriesApplicable.map((c, i) => (
                <li key={i} className="rounded border border-border p-2"><strong>{c.label}</strong> - <span className="text-muted-foreground">{c.why}</span></li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          {!done ? (
            <Button onClick={() => setDone(true)}>See applicable categories</Button>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}