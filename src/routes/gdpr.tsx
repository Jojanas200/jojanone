import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  saveGdprAssessment, newGdprAssessmentDraft,
  upsertProcessingActivity, archiveProcessingActivity, restoreProcessingActivity, deleteProcessingActivity, newProcessingActivityDraft,
  upsertDataRequest, completeDataRequest, newDataRequestDraft,
  upsertBreach, newBreachDraft,
  upsertDpia, newDpiaDraft,
  upsertPrivacyNotice, newPrivacyNoticeDraft,
  createConversation, appendMessage,
} from "@/data/store";
import { gdprMetrics } from "@/data/cg-selectors";
import { formatDate } from "@/data/selectors";
import type { GdprAssessment, ProcessingActivity, DataRequest, DataBreach, Dpia, PrivacyNotice, DataRequestType } from "@/data/types";
import {
  Button, Card, Field, Input, Textarea, SectionHeader, InfoRow,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/business/shared";
import { MetricCard } from "@/components/core/MetricCard";
import { EmptyState } from "@/components/core/EmptyState";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/core/StatusPill";
import { Lock, Plus, MessageSquare, Printer, Info, ClipboardCheck, FileText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/gdpr")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    pa: typeof s.pa === "string" ? s.pa : undefined,
    dr: typeof s.dr === "string" ? s.dr : undefined,
    br: typeof s.br === "string" ? s.br : undefined,
    dpia: typeof s.dpia === "string" ? s.dpia : undefined,
  }),
  head: () => ({
    meta: [
      { title: "GDPR - Jojan One" },
      { name: "description", content: "Data protection workspace: health check, ROPA, requests, breaches, DPIAs and privacy notices." },
    ],
  }),
  component: GdprPage,
});

const HEALTH_QUESTIONS: Array<{ key: string; label: string }> = [
  { key: "purposes_documented", label: "Are your processing purposes documented?" },
  { key: "lawful_basis_documented", label: "Is a lawful basis identified for each purpose?" },
  { key: "privacy_notice_current", label: "Is your public privacy notice current and accurate?" },
  { key: "rights_process", label: "Do you have a process for handling individual rights requests?" },
  { key: "retention_schedule", label: "Is a retention schedule documented?" },
  { key: "processor_agreements", label: "Do you have written processor agreements in place?" },
  { key: "security_measures", label: "Have technical and organisational security measures been documented?" },
  { key: "staff_training", label: "Have staff received data protection training?" },
  { key: "breach_process", label: "Do you have a breach response process?" },
  { key: "international_transfers", label: "Have international data transfers been assessed?" },
  { key: "childrens_data", label: "Have you considered children's data (if any)?" },
  { key: "special_category_data", label: "If you process special category data, is a condition identified?" },
  { key: "dpia_process", label: "Do you have a DPIA screening process?" },
  { key: "record_keeping", label: "Do you keep a Record of Processing Activities (ROPA)?" },
];

const disclaimer = "Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.";

function GdprPage() {
  const state = useCoreData((s) => s);
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const m = gdprMetrics(state);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold text-foreground"><Lock className="h-5 w-5" strokeWidth={1.75} /> GDPR</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Data protection workspace. Deterministic mock rules - not a substitute for legal or DPO advice.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Readiness" value={`${m.readiness}/100`} tone={m.readiness >= 80 ? "success" : m.readiness >= 65 ? "warning" : "danger"} />
        <MetricCard label="Open gaps" value={m.gaps.length} tone={m.gaps.length ? "warning" : "success"} />
        <MetricCard label="Processing activities" value={m.processing} />
        <MetricCard label="Open data requests" value={m.openRequests.length} tone={m.openRequests.length ? "warning" : "default"} />
        <MetricCard label="Open breaches" value={m.openBreaches.length} tone={m.openBreaches.length ? "danger" : "success"} />
        <MetricCard label="DPIAs needing review" value={m.dpiaReview.length} />
        <MetricCard label="Privacy notice" value={m.noticeOutdated ? "Review due" : "Current"} tone={m.noticeOutdated ? "warning" : "success"} />
        <MetricCard label="ICO fee" value={m.ico?.status === "completed" ? "Paid" : "Check"} tone={m.ico?.status === "completed" ? "success" : "warning"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Check</TabsTrigger>
          <TabsTrigger value="ropa">ROPA</TabsTrigger>
          <TabsTrigger value="requests">Data Requests</TabsTrigger>
          <TabsTrigger value="breaches">Breaches</TabsTrigger>
          <TabsTrigger value="dpia">DPIAs</TabsTrigger>
          <TabsTrigger value="notice">Privacy Notice</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "overview" && <OverviewTab />}
      {tab === "health" && <HealthCheckTab />}
      {tab === "ropa" && <RopaTab />}
      {tab === "requests" && <RequestsTab />}
      {tab === "breaches" && <BreachesTab />}
      {tab === "dpia" && <DpiaTab />}
      {tab === "notice" && <NoticeTab />}

      <p className="text-[11px] text-muted-foreground"><Info className="mr-1 inline h-3.5 w-3.5" />{disclaimer}</p>
    </div>
  );
}

function OverviewTab() {
  const s = useCoreData((x) => x);
  const m = gdprMetrics(s);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border border-border bg-card p-5 shadow-none">
        <SectionHeader title="Open gaps" description="From the latest health check" />
        <ul className="mt-3 space-y-2 text-[13px]">
          {m.gaps.length === 0 ? <li className="text-muted-foreground">No open gaps.</li> :
            m.gaps.map((g, i) => <li key={i} className="rounded border border-border p-2">• {g}</li>)}
        </ul>
      </Card>
      <Card className="border border-border bg-card p-5 shadow-none">
        <SectionHeader title="Open data requests" />
        <ul className="mt-3 space-y-2 text-[13px]">
          {m.openRequests.length === 0 ? <li className="text-muted-foreground">No open requests.</li> :
            m.openRequests.map((r) => <li key={r.id} className="rounded border border-border p-2"><strong>{r.requester_reference}</strong> - {r.request_type} • due {formatDate(r.due_date)}</li>)}
        </ul>
      </Card>
    </div>
  );
}

function HealthCheckTab() {
  const s = useCoreData((x) => x);
  const [running, setRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, "yes" | "no" | "unsure">>({});
  const [step, setStep] = useState(0);

  const last = s.gdpr_assessments[0];

  const startNew = () => { setRunning(true); setAnswers({}); setStep(0); };
  const submit = () => {
    const yes = Object.values(answers).filter((v) => v === "yes").length;
    const total = HEALTH_QUESTIONS.length;
    const score = Math.round((yes / total) * 100);
    const gaps = HEALTH_QUESTIONS.filter((q) => answers[q.key] !== "yes").map((q) => q.label);
    const recs = gaps.map((g) => ({ label: g.replace(/^Is|^Are|^Do|^Have|^If /, "Address:").replace("?", ""), priority: (score < 60 ? "high" : "medium") as "high" | "medium" }));
    saveGdprAssessment({ ...newGdprAssessmentDraft(), answers, score, status: "completed", gaps, recommendations: recs, completed_at: new Date().toISOString(), review_date: new Date(Date.now() + 365 * 86400000).toISOString() });
    toast.success(`Health check complete - score ${score}/100.`);
    setRunning(false);
  };

  if (!running) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border border-border bg-card p-5 shadow-none">
          <SectionHeader title="Latest GDPR Health Check" action={<Button onClick={startNew}><ClipboardCheck className="mr-1 h-4 w-4" />Run new assessment</Button>} />
          {last ? (
            <div className="mt-3 text-[13px]">
              <p>Score: <strong>{last.score}/100</strong> - {last.status} • completed {last.completed_at ? formatDate(last.completed_at) : "-"}</p>
              {last.gaps.length > 0 && (
                <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gaps</p>
                  <ul className="mt-1 space-y-1">{last.gaps.map((g, i) => <li key={i}>• {g}</li>)}</ul>
                </div>
              )}
              {last.recommendations.length > 0 && (
                <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recommendations</p>
                  <ul className="mt-1 space-y-1">{last.recommendations.map((r, i) => <li key={i}>• [{r.priority}] {r.label}</li>)}</ul>
                </div>
              )}
            </div>
          ) : <p className="mt-3 text-[13px] text-muted-foreground">No health check on record. Run one to establish a readiness score.</p>}
        </Card>
      </div>
    );
  }

  const q = HEALTH_QUESTIONS[step];
  return (
    <Card className="border border-border bg-card p-5 shadow-none">
      <div className="mb-3 flex items-center justify-between text-[12px] text-muted-foreground">
        <span>Question {step + 1} of {HEALTH_QUESTIONS.length}</span>
        <Button size="sm" variant="ghost" onClick={() => { setRunning(false); }}>Save and exit</Button>
      </div>
      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-[oklch(0.94_0.005_260)]"><div className="h-full bg-primary" style={{ width: `${((step + 1) / HEALTH_QUESTIONS.length) * 100}%` }} /></div>
      <p className="mt-4 text-[15px] font-medium">{q.label}</p>
      <div className="mt-3 flex gap-2">
        {(["yes", "no", "unsure"] as const).map((v) => (
          <Button key={v} variant={answers[q.key] === v ? "default" : "outline"} onClick={() => setAnswers({ ...answers, [q.key]: v })}>{v}</Button>
        ))}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < HEALTH_QUESTIONS.length - 1 ? (
          <Button disabled={!answers[q.key]} onClick={() => setStep(step + 1)}>Next</Button>
        ) : (
          <Button disabled={!answers[q.key]} onClick={submit}>Complete</Button>
        )}
      </div>
    </Card>
  );
}

function RopaTab() {
  const s = useCoreData((x) => x);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<ProcessingActivity | null>(null);
  const list = useMemo(() => s.processing_activities.filter((p) => (q ? p.activity_name.toLowerCase().includes(q.toLowerCase()) : true)), [s.processing_activities, q]);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Record of Processing Activities" action={<div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-[220px]" /><Button onClick={() => setForm(newProcessingActivityDraft())}><Plus className="mr-1 h-4 w-4" />New activity</Button></div>} />
      {list.length === 0 ? <EmptyState icon={FileText} title="No ROPA entries" /> : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[oklch(0.98_0.003_260)] text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3 text-left">Activity</th><th className="p-3 text-left">Lawful basis</th><th className="p-3 text-left">Retention</th><th className="p-3 text-left">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3"><button className="font-medium hover:underline" onClick={() => setForm(p)}>{p.activity_name}</button><div className="text-[11px] text-muted-foreground">{p.business_purpose}</div></td>
                  <td className="p-3">{p.lawful_basis}</td>
                  <td className="p-3">{p.retention_period}</td>
                  <td className="p-3"><StatusPill tone={p.status === "active" ? "success" : "neutral"}>{p.status}</StatusPill></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...p, id: `pa_copy_${Date.now()}`, activity_name: p.activity_name + " (copy)" })}>Duplicate</Button>
                    {p.status === "active" ? <Button size="sm" variant="ghost" onClick={() => { archiveProcessingActivity(p.id); toast.success("Archived."); }}>Archive</Button> : <Button size="sm" variant="ghost" onClick={() => { restoreProcessingActivity(p.id); toast.success("Restored."); }}>Restore</Button>}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this activity?")) { deleteProcessingActivity(p.id); toast.success("Deleted."); } }}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{s.processing_activities.find((x) => x.id === form?.id) ? "Edit activity" : "New activity"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <Field label="Name" required><Input value={form.activity_name} onChange={(e) => setForm({ ...form, activity_name: e.target.value })} /></Field>
              <Field label="Business purpose" required><Textarea value={form.business_purpose} onChange={(e) => setForm({ ...form, business_purpose: e.target.value })} rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data subjects"><Input value={form.data_subjects} onChange={(e) => setForm({ ...form, data_subjects: e.target.value })} /></Field>
                <Field label="Personal data"><Input value={form.personal_data_categories} onChange={(e) => setForm({ ...form, personal_data_categories: e.target.value })} /></Field>
                <Field label="Lawful basis" required><Input value={form.lawful_basis} onChange={(e) => setForm({ ...form, lawful_basis: e.target.value })} /></Field>
                <Field label="Retention period" required><Input value={form.retention_period} onChange={(e) => setForm({ ...form, retention_period: e.target.value })} /></Field>
                <Field label="Recipients"><Input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} /></Field>
                <Field label="Processors"><Input value={form.processors} onChange={(e) => setForm({ ...form, processors: e.target.value })} /></Field>
              </div>
              <Field label="Security measures"><Textarea value={form.security_measures} onChange={(e) => setForm({ ...form, security_measures: e.target.value })} rows={2} /></Field>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.special_category_data} onChange={(e) => setForm({ ...form, special_category_data: e.target.checked })} />Includes special category data</label>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.international_transfers} onChange={(e) => setForm({ ...form, international_transfers: e.target.checked })} />Involves international transfers</label>
              <p className="text-[11px] text-muted-foreground">Lawful basis is your assessment - not a legal verification.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => { if (!form?.activity_name || !form.lawful_basis || !form.retention_period) return toast.error("Name, lawful basis and retention required."); upsertProcessingActivity(form); toast.success("Saved."); setForm(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestsTab() {
  const s = useCoreData((x) => x);
  const [form, setForm] = useState<DataRequest | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Individual rights requests" action={<Button onClick={() => setForm(newDataRequestDraft())}><Plus className="mr-1 h-4 w-4" />Add request</Button>} />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[oklch(0.98_0.003_260)] text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Received</th><th className="p-3 text-left">Due</th><th className="p-3 text-left">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {s.data_requests.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3"><button className="font-medium hover:underline" onClick={() => setForm(r)}>{r.requester_reference}</button></td>
                <td className="p-3">{r.request_type}</td>
                <td className="p-3">{formatDate(r.received_date)}</td>
                <td className="p-3">{formatDate(r.due_date)}</td>
                <td className="p-3"><StatusPill tone={r.status === "completed" ? "success" : r.status === "open" ? "warning" : "info"}>{r.status}</StatusPill></td>
                <td className="p-3 text-right">{r.status !== "completed" && <Button size="sm" variant="outline" onClick={() => { completeDataRequest(r.id); toast.success("Completed."); }}>Complete</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{s.data_requests.find((x) => x.id === form?.id) ? "Edit request" : "New request"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <Field label="Requester reference" required><Input value={form.requester_reference} onChange={(e) => setForm({ ...form, requester_reference: e.target.value })} /></Field>
              <Field label="Request type">
                <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v as DataRequestType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["subject_access","rectification","erasure","restriction","objection","portability"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Received"><Input type="date" value={form.received_date.slice(0,10)} onChange={(e) => setForm({ ...form, received_date: new Date(e.target.value).toISOString() })} /></Field>
                <Field label="Due" hint="Standard target: one month; adjust where appropriate."><Input type="date" value={form.due_date.slice(0,10)} onChange={(e) => setForm({ ...form, due_date: new Date(e.target.value).toISOString() })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.identity_verified} onChange={(e) => setForm({ ...form, identity_verified: e.target.checked })} />Identity verified</label>
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => { if (!form?.requester_reference) return toast.error("Reference required."); upsertDataRequest(form); toast.success("Saved."); setForm(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BreachesTab() {
  const s = useCoreData((x) => x);
  const [form, setForm] = useState<DataBreach | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Data breach log" action={<Button onClick={() => setForm(newBreachDraft())}><Plus className="mr-1 h-4 w-4" />Log incident</Button>} />
      <p className="rounded-md border border-[oklch(0.9_0.06_75)] bg-[oklch(0.98_0.04_85)] p-3 text-[12px]"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Notification decisions may require professional data-protection or legal judgement. Jojan One helps organise the assessment but does not make the final legal determination.</p>
      <div className="grid gap-3">
        {s.data_breaches.length === 0 && <EmptyState icon={ShieldAlert} title="No incidents logged" />}
        {s.data_breaches.map((b) => (
          <Card key={b.id} className="border border-border bg-card p-4 shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <button className="text-[15px] font-semibold hover:underline" onClick={() => setForm(b)}>{b.title}</button>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Discovered {formatDate(b.discovered_at)} • {b.risk_level} risk</p>
                <p className="mt-1 text-[13px]">{b.description}</p>
              </div>
              <StatusPill tone={b.status === "closed" ? "success" : "warning"}>{b.status}</StatusPill>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{s.data_breaches.find((x) => x.id === form?.id) ? "Edit incident" : "Log incident"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discovered"><Input type="datetime-local" value={form.discovered_at.slice(0,16)} onChange={(e) => setForm({ ...form, discovered_at: new Date(e.target.value).toISOString() })} /></Field>
                <Field label="Risk level">
                  <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v as "low" | "medium" | "high" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Affected people (est.)"><Input type="number" value={form.affected_people_estimate} onChange={(e) => setForm({ ...form, affected_people_estimate: Number(e.target.value) })} /></Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "open" | "contained" | "closed" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="contained">Contained</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="What happened"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>
              <Field label="Data involved"><Input value={form.data_involved} onChange={(e) => setForm({ ...form, data_involved: e.target.value })} /></Field>
              <Field label="Containment actions"><Textarea value={form.containment_actions} onChange={(e) => setForm({ ...form, containment_actions: e.target.value })} rows={2} /></Field>
              <Field label="ICO notification assessment" hint="Your written assessment; Jojan One does not automatically state notification is required."><Textarea value={form.ico_notification_assessment} onChange={(e) => setForm({ ...form, ico_notification_assessment: e.target.value })} rows={2} /></Field>
              <Field label="Individual notification assessment"><Textarea value={form.individual_notification_assessment} onChange={(e) => setForm({ ...form, individual_notification_assessment: e.target.value })} rows={2} /></Field>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.professional_support_required} onChange={(e) => setForm({ ...form, professional_support_required: e.target.checked })} />Professional support required</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => { if (!form) return; const w = window.open("", "_blank"); if (!w) return; w.document.write(`<pre style="font-family:system-ui;padding:2rem;max-width:720px">${JSON.stringify(form, null, 2)}</pre>`); w.print(); }}><Printer className="mr-1 h-3.5 w-3.5" />Print</Button>
            <Button onClick={() => { if (!form?.title) return toast.error("Title required."); upsertBreach({ ...form, closed_at: form.status === "closed" ? new Date().toISOString() : null }); toast.success("Saved."); setForm(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DpiaTab() {
  const s = useCoreData((x) => x);
  const [form, setForm] = useState<Dpia | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="DPIA register" action={<Button onClick={() => setForm(newDpiaDraft())}><Plus className="mr-1 h-4 w-4" />New DPIA</Button>} />
      <div className="grid gap-3">
        {s.dpias.map((d) => (
          <Card key={d.id} className="border border-border bg-card p-4 shadow-none">
            <div className="flex items-start justify-between">
              <div>
                <button className="text-[15px] font-semibold hover:underline" onClick={() => setForm(d)}>{d.title}</button>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{d.project} • review {d.review_date ? formatDate(d.review_date) : "-"}</p>
                <p className="mt-1 text-[13px]">{d.processing_summary}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusPill tone={d.status === "approved" ? "success" : d.status === "draft" ? "warning" : "info"}>{d.status}</StatusPill>
                <StatusPill tone={d.residual_risk === "high" ? "danger" : d.residual_risk === "medium" ? "warning" : "success"}>{d.residual_risk} residual</StatusPill>
              </div>
            </div>
          </Card>
        ))}
        {s.dpias.length === 0 && <EmptyState icon={FileText} title="No DPIAs" />}
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{s.dpias.find((x) => x.id === form?.id) ? "Edit DPIA" : "New DPIA"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Project"><Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} /></Field>
              <Field label="Processing summary"><Textarea value={form.processing_summary} onChange={(e) => setForm({ ...form, processing_summary: e.target.value })} /></Field>
              <Field label="Necessity"><Textarea value={form.necessity} onChange={(e) => setForm({ ...form, necessity: e.target.value })} rows={2} /></Field>
              <Field label="Risks"><Textarea value={form.risks} onChange={(e) => setForm({ ...form, risks: e.target.value })} rows={2} /></Field>
              <Field label="Controls"><Textarea value={form.controls} onChange={(e) => setForm({ ...form, controls: e.target.value })} rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Residual risk">
                  <Select value={form.residual_risk} onValueChange={(v) => setForm({ ...form, residual_risk: v as "low" | "medium" | "high" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "draft" | "approved" | "review_due" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="review_due">Review due</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Review date"><Input type="date" value={form.review_date?.slice(0,10) ?? ""} onChange={(e) => setForm({ ...form, review_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => { if (!form?.title) return toast.error("Title required."); upsertDpia(form); toast.success("Saved."); setForm(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoticeTab() {
  const s = useCoreData((x) => x);
  const [draft, setDraft] = useState<PrivacyNotice | null>(null);
  const notice = s.privacy_notices[0];
  const preview = draft ?? notice;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border border-border bg-card p-5 shadow-none">
        <SectionHeader title="Privacy notice builder" action={<Button onClick={() => setDraft(newPrivacyNoticeDraft({ contact_details: notice?.contact_details ?? "", data_collected: notice?.data_collected ?? "", purposes: notice?.purposes ?? "", lawful_bases: notice?.lawful_bases ?? [] }))}><Plus className="mr-1 h-4 w-4" />New draft</Button>} />
        {!draft && notice && (
          <div className="mt-3 text-[13px] space-y-1">
            <p><strong>{notice.organisation}</strong> - v{notice.version} • {notice.status}</p>
            <Button variant="outline" size="sm" onClick={() => setDraft({ ...notice, id: `pn_draft_${Date.now()}`, status: "draft", version: `${notice.version}-draft` })}>Edit as draft</Button>
          </div>
        )}
        {draft && (
          <div className="mt-3 grid gap-3">
            <Field label="Contact details"><Input value={draft.contact_details} onChange={(e) => setDraft({ ...draft, contact_details: e.target.value })} /></Field>
            <Field label="Data collected"><Textarea value={draft.data_collected} onChange={(e) => setDraft({ ...draft, data_collected: e.target.value })} /></Field>
            <Field label="Purposes"><Textarea value={draft.purposes} onChange={(e) => setDraft({ ...draft, purposes: e.target.value })} /></Field>
            <Field label="Lawful bases (comma-separated)"><Input value={draft.lawful_bases.join(", ")} onChange={(e) => setDraft({ ...draft, lawful_bases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field>
            <Field label="Sharing"><Textarea value={draft.sharing} onChange={(e) => setDraft({ ...draft, sharing: e.target.value })} /></Field>
            <Field label="International transfers"><Input value={draft.international_transfers} onChange={(e) => setDraft({ ...draft, international_transfers: e.target.value })} /></Field>
            <Field label="Retention"><Input value={draft.retention} onChange={(e) => setDraft({ ...draft, retention: e.target.value })} /></Field>
            <Field label="Rights"><Textarea value={draft.rights} onChange={(e) => setDraft({ ...draft, rights: e.target.value })} rows={2} /></Field>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={() => { upsertPrivacyNotice({ ...draft, status: "draft" }); toast.success("Draft saved."); }}>Save draft</Button>
            </div>
          </div>
        )}
      </Card>
      <Card className="border border-border bg-card p-5 shadow-none">
        <SectionHeader title="Preview" action={<Button variant="outline" size="sm" onClick={() => { if (!preview) return; const w = window.open("", "_blank"); if (!w) return; w.document.write(renderNotice(preview)); w.print(); }}><Printer className="mr-1 h-3.5 w-3.5" />Print / PDF</Button>} />
        {preview ? <NoticePreview n={preview} /> : <p className="mt-3 text-[13px] text-muted-foreground">No notice.</p>}
      </Card>
    </div>
  );
}

function NoticePreview({ n }: { n: PrivacyNotice }) {
  return (
    <div className="mt-3 space-y-3 text-[13px] leading-relaxed">
      <div className="rounded border border-[oklch(0.9_0.06_75)] bg-[oklch(0.98_0.04_85)] p-2 text-[11px] font-medium text-[oklch(0.45_0.15_75)]">Draft - Review Before Use</div>
      <p><strong>{n.organisation} - Privacy notice</strong> (v{n.version})</p>
      <p><strong>Contact:</strong> {n.contact_details || "-"}</p>
      <p><strong>Data we collect:</strong> {n.data_collected || "-"}</p>
      <p><strong>Purposes:</strong> {n.purposes || "-"}</p>
      <p><strong>Lawful bases:</strong> {n.lawful_bases.join(", ") || "-"}</p>
      <p><strong>Sharing:</strong> {n.sharing || "-"}</p>
      <p><strong>International transfers:</strong> {n.international_transfers || "-"}</p>
      <p><strong>Retention:</strong> {n.retention || "-"}</p>
      <p><strong>Your rights:</strong> {n.rights}</p>
      <p><strong>Complaints:</strong> {n.complaints}</p>
    </div>
  );
}

function renderNotice(n: PrivacyNotice) {
  return `<html><head><title>${n.organisation} Privacy Notice</title><style>body{font-family:system-ui;padding:2rem;max-width:720px}h1{margin-bottom:.25rem}</style></head><body>
    <div style="border:1px solid #e2b530;background:#fff7d9;padding:.5rem;margin-bottom:1rem;font-size:12px">Draft - Review Before Use</div>
    <h1>${n.organisation} - Privacy Notice</h1>
    <p>Version ${n.version}</p>
    <p><strong>Contact:</strong> ${n.contact_details}</p>
    <p><strong>Data we collect:</strong> ${n.data_collected}</p>
    <p><strong>Purposes:</strong> ${n.purposes}</p>
    <p><strong>Lawful bases:</strong> ${n.lawful_bases.join(", ")}</p>
    <p><strong>Sharing:</strong> ${n.sharing}</p>
    <p><strong>International transfers:</strong> ${n.international_transfers}</p>
    <p><strong>Retention:</strong> ${n.retention}</p>
    <p><strong>Your rights:</strong> ${n.rights}</p>
    <p><strong>Complaints:</strong> ${n.complaints}</p>
    <p style="font-size:11px;color:#666;margin-top:2rem">Generated by Jojan One. Not legally approved.</p>
  </body></html>`;
}