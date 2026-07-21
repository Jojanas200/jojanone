import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  upsertGovernanceRecord, updateGovernanceStatus, deleteGovernanceRecord, newGovernanceDraft,
  upsertPolicy, recordPolicyReview, archivePolicy, newPolicyDraft,
} from "@/data/store";
import { governanceMetrics } from "@/data/cg-selectors";
import { formatDate } from "@/data/selectors";
import type { GovernanceRecord, Policy, GovernanceRecordType } from "@/data/types";
import {
  Button, Card, Field, Input, Textarea, SectionHeader, InfoRow,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/business/shared";
import { MetricCard } from "@/components/core/MetricCard";
import { EmptyState } from "@/components/core/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/core/StatusPill";
import { Landmark, Plus, Printer, CheckCircle2, XCircle, Archive, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/governance")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    g: typeof s.g === "string" ? s.g : undefined,
    p: typeof s.p === "string" ? s.p : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Governance - Jojan One" },
      { name: "description", content: "Decisions, meetings, minutes and policy register." },
    ],
  }),
  component: GovernancePage,
});

const RECORD_TYPES: Array<[GovernanceRecordType, string]> = [
  ["board_meeting", "Board meeting"],
  ["meeting_minutes", "Meeting minutes"],
  ["director_decision", "Director decision"],
  ["shareholder_decision", "Shareholder decision"],
  ["written_resolution", "Written resolution"],
  ["governance_review", "Governance review"],
];

function GovernancePage() {
  const s = useCoreData((x) => x);
  const [tab, setTab] = useState("records");
  const m = governanceMetrics(s);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold text-foreground"><Landmark className="h-5 w-5" strokeWidth={1.75} /> Governance</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Track decisions, meetings, minutes and policies - deterministic mock workflow.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Governance health" value={m.pending.length === 0 && m.minutesPending.length === 0 ? "Good" : "Attention"} tone={m.pending.length === 0 && m.minutesPending.length === 0 ? "success" : "warning"} />
        <MetricCard label="Awaiting approval" value={m.pending.length} tone={m.pending.length ? "warning" : "default"} />
        <MetricCard label="Minutes to sign" value={m.minutesPending.length} tone={m.minutesPending.length ? "warning" : "default"} />
        <MetricCard label="Policies due" value={m.policiesDue.length} tone={m.policiesDue.length ? "warning" : "default"} />
        <MetricCard label="Meetings scheduled" value={m.meetings.length} />
        <MetricCard label="Completed 90d" value={m.completedQuarter.length} tone="success" />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "records" && <RecordsTab />}
      {tab === "policies" && <PoliciesTab />}
      {tab === "calendar" && <CalendarTab />}
      <p className="text-[11px] text-muted-foreground"><Info className="mr-1 inline h-3.5 w-3.5" />Not legal advice. Complex governance matters should be reviewed with a solicitor or company secretary.</p>
    </div>
  );
}

function RecordsTab() {
  const s = useCoreData((x) => x);
  const [form, setForm] = useState<GovernanceRecord | null>(null);
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const list = useMemo(() => s.governance_records
    .filter((g) => (typeF === "all" ? true : g.record_type === typeF))
    .filter((g) => (statusF === "all" ? true : g.status === statusF))
    .filter((g) => (q ? (g.title + g.description).toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => (b.meeting_date ?? b.decision_date ?? b.updated_at).localeCompare(a.meeting_date ?? a.decision_date ?? a.updated_at)),
    [s.governance_records, typeF, statusF, q]);

  const printRecord = (g: GovernanceRecord) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>${g.title}</title><style>body{font-family:system-ui;padding:2rem;max-width:720px}</style></head><body>
      <h1>${g.title}</h1><p>${g.record_type} - ${g.status}</p>
      <p><strong>Description:</strong> ${g.description}</p>
      <p><strong>Participants:</strong> ${g.participants}</p>
      <p><strong>Date:</strong> ${g.meeting_date ?? g.decision_date ?? "-"}</p>
      <p><strong>Decision:</strong> ${g.decision ?? "-"}</p>
      <p><strong>Actions:</strong> ${g.actions}</p>
      <p><strong>Notes:</strong> ${g.notes}</p></body></html>`); w.print();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 min-w-[200px]" />
        <Select value={typeF} onValueChange={setTypeF}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{RECORD_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={statusF} onValueChange={setStatusF}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{["draft","pending","approved","deferred","rejected","completed"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
        <Button onClick={() => setForm(newGovernanceDraft())}><Plus className="mr-1 h-4 w-4" />New record</Button>
      </div>
      {list.length === 0 ? <EmptyState icon={Landmark} title="No records" /> :
        <div className="grid gap-3">
          {list.map((g) => (
            <Card key={g.id} className="border border-border bg-card p-4 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <button className="text-[15px] font-semibold hover:underline" onClick={() => setForm(g)}>{g.title}</button>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{RECORD_TYPES.find((r) => r[0] === g.record_type)?.[1]} • {g.meeting_date ? `meeting ${formatDate(g.meeting_date)}` : g.decision_date ? `decision ${formatDate(g.decision_date)}` : "-"}</p>
                  <p className="mt-1 text-[13px]">{g.description}</p>
                </div>
                <StatusPill tone={g.status === "approved" || g.status === "completed" ? "success" : g.status === "pending" ? "warning" : g.status === "rejected" ? "danger" : "neutral"}>{g.status}</StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {g.status !== "approved" && g.status !== "completed" && <Button size="sm" onClick={() => { updateGovernanceStatus(g.id, "approved"); toast.success("Approved."); }}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</Button>}
                {g.status !== "deferred" && <Button size="sm" variant="outline" onClick={() => { updateGovernanceStatus(g.id, "deferred"); toast.success("Deferred."); }}>Defer</Button>}
                <Button size="sm" variant="ghost" onClick={() => printRecord(g)}><Printer className="mr-1 h-3.5 w-3.5" />Print</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this record?")) { deleteGovernanceRecord(g.id); toast.success("Deleted."); } }}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{s.governance_records.find((g) => g.id === form?.id) ? "Edit record" : "New record"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <Field label="Type">
                <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v as GovernanceRecordType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECORD_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Meeting date"><Input type="date" value={form.meeting_date?.slice(0,10) ?? ""} onChange={(e) => setForm({ ...form, meeting_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
                <Field label="Decision date"><Input type="date" value={form.decision_date?.slice(0,10) ?? ""} onChange={(e) => setForm({ ...form, decision_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
                <Field label="Owner"><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as GovernanceRecord["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["draft","pending","approved","deferred","rejected","completed"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Participants"><Input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} /></Field>
              {form.record_type === "director_decision" && (
                <>
                  <Field label="Background"><Textarea value={form.background ?? ""} onChange={(e) => setForm({ ...form, background: e.target.value })} rows={2} /></Field>
                  <Field label="Options considered"><Textarea value={form.options_considered ?? ""} onChange={(e) => setForm({ ...form, options_considered: e.target.value })} rows={2} /></Field>
                  <Field label="Risks considered"><Textarea value={form.risks_considered ?? ""} onChange={(e) => setForm({ ...form, risks_considered: e.target.value })} rows={2} /></Field>
                  <Field label="Decision"><Textarea value={form.decision ?? ""} onChange={(e) => setForm({ ...form, decision: e.target.value })} rows={2} /></Field>
                  <Field label="Decision maker"><Input value={form.decision_maker ?? ""} onChange={(e) => setForm({ ...form, decision_maker: e.target.value })} /></Field>
                </>
              )}
              <Field label="Actions"><Textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} rows={2} /></Field>
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => { if (!form?.title) return toast.error("Title required."); upsertGovernanceRecord(form); toast.success("Saved."); setForm(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PoliciesTab() {
  const s = useCoreData((x) => x);
  const [form, setForm] = useState<Policy | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Policy register" action={<Button onClick={() => setForm(newPolicyDraft())}><Plus className="mr-1 h-4 w-4" />New policy</Button>} />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[oklch(0.98_0.003_260)] text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3 text-left">Policy</th><th className="p-3 text-left">Version</th><th className="p-3 text-left">Owner</th><th className="p-3 text-left">Next review</th><th className="p-3 text-left">Acks</th><th className="p-3 text-left">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {s.policies.map((p) => {
              const overdue = p.review_date && new Date(p.review_date).getTime() < Date.now();
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3"><button className="font-medium hover:underline" onClick={() => setForm(p)}>{p.policy_name}</button><div className="text-[11px] text-muted-foreground">{p.policy_category}</div></td>
                  <td className="p-3">v{p.version}</td>
                  <td className="p-3">{p.owner}</td>
                  <td className="p-3">{p.review_date ? <span className={overdue ? "text-[oklch(0.5_0.2_25)]" : ""}>{formatDate(p.review_date)}{overdue ? " (overdue)" : ""}</span> : "-"}</td>
                  <td className="p-3">{p.acknowledgement_required ? p.acknowledgement_status : "n/a"}</td>
                  <td className="p-3"><StatusPill tone={p.status === "active" ? "success" : p.status === "draft" ? "warning" : "neutral"}>{p.status}</StatusPill></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => { recordPolicyReview(p.id); toast.success("Review recorded."); }}>Record review</Button>
                    {p.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => { archivePolicy(p.id); toast.success("Archived."); }}><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{s.policies.find((p) => p.id === form?.id) ? "Edit policy" : "New policy"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <Field label="Name" required><Input value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category"><Input value={form.policy_category} onChange={(e) => setForm({ ...form, policy_category: e.target.value })} /></Field>
                <Field label="Version"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
                <Field label="Owner"><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Policy["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Review date"><Input type="date" value={form.review_date?.slice(0,10) ?? ""} onChange={(e) => setForm({ ...form, review_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
                <Field label="Approval date"><Input type="date" value={form.approval_date?.slice(0,10) ?? ""} onChange={(e) => setForm({ ...form, approval_date: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.acknowledgement_required} onChange={(e) => setForm({ ...form, acknowledgement_required: e.target.checked })} />Acknowledgement required</label>
              {form.acknowledgement_required && (
                <Field label="Acknowledgement status">
                  <Select value={form.acknowledgement_status} onValueChange={(v) => setForm({ ...form, acknowledgement_status: v as Policy["acknowledgement_status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="not_started">Not started</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="complete">Complete</SelectItem></SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={() => { if (!form?.policy_name) return toast.error("Name required."); upsertPolicy(form); toast.success("Saved."); setForm(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarTab() {
  const s = useCoreData((x) => x);
  const items = [
    ...s.governance_records.filter((g) => g.meeting_date || g.decision_date).map((g) => ({ id: g.id, date: g.meeting_date ?? g.decision_date!, label: g.title, kind: g.record_type })),
    ...s.policies.filter((p) => p.review_date).map((p) => ({ id: p.id, date: p.review_date!, label: `Review: ${p.policy_name}`, kind: "policy_review" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card className="border border-border bg-card p-5 shadow-none">
      <SectionHeader title="Governance calendar" />
      <ul className="mt-3 divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between py-2 text-[13px]">
            <span>{it.label} <span className="text-[11px] text-muted-foreground">({it.kind})</span></span>
            <span className="text-muted-foreground">{formatDate(it.date)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}