import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  upsertEmployee,
  archiveEmployee,
  deleteEmployee,
  newEmployeeDraft,
  upsertHrAction,
  newHrActionDraft,
  completeHrAction,
  reopenHrAction,
  deferHrAction,
  deleteHrAction,
  createConversation,
  appendMessage,
} from "@/data/store";
import { employeeMetrics, openHrActions } from "@/data/business-selectors";
import { formatDate, formatRelative } from "@/data/selectors";
import type { Employee, HrAction, HrActionType, EmploymentType, EmploymentStatus } from "@/data/types";
import {
  Button, Card, Field, Input, InfoRow, SectionHeader,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, DateStatusBadge,
  disclaimerHr,
} from "@/components/business/shared";
import { MetricCard } from "@/components/core/MetricCard";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Search, Pencil, Archive, Trash2, MessageSquare, Check, RotateCcw, CalendarClock, Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hr")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    e: typeof s.e === "string" ? s.e : undefined,
    a: typeof s.a === "string" ? s.a : undefined,
  }),
  head: () => ({
    meta: [
      { title: "HR - Jojan One" },
      { name: "description", content: "Employee and HR-compliance workspace." },
    ],
  }),
  component: HrPage,
});

const HR_ACTION_LABEL: Record<HrActionType, string> = {
  right_to_work: "Right-to-work check",
  probation_review: "Probation review",
  contract_issue: "Contract issue",
  training: "Training",
  policy_ack: "Policy acknowledgement",
  performance_review: "Performance review",
  return_to_work: "Return-to-work meeting",
  welfare: "Welfare",
  document_renewal: "Document renewal",
};

function HrPage() {
  const state = useCoreData((s) => s);
  const employees = state.employees;
  const actions = state.hr_actions;
  const { e: openE, a: openA } = Route.useSearch();
  const navigate = useNavigate();

  const [view, setView] = useState<"table" | "cards">("table");
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [deptF, setDeptF] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(openE ?? null);
  const [actionDetailId, setActionDetailId] = useState<string | null>(openA ?? null);
  const [formEmployee, setFormEmployee] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [creatingAction, setCreatingAction] = useState<string | null>(null); // employee id

  const metrics = employeeMetrics(state);

  const depts = useMemo(() => Array.from(new Set(employees.map((e) => e.department).filter(Boolean))), [employees]);

  const filtered = useMemo(() => {
    return employees
      .filter((e) => typeF === "all" || e.employment_type === typeF)
      .filter((e) => statusF === "all" || e.employment_status === statusF)
      .filter((e) => deptF === "all" || e.department === deptF)
      .filter((e) => {
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return e.full_name.toLowerCase().includes(t) || e.job_title.toLowerCase().includes(t);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [employees, q, typeF, statusF, deptF]);

  const detail = employees.find((e) => e.id === detailId) ?? null;
  const employeeActions = detail ? actions.filter((a) => a.employee_id === detail.id) : [];
  const actionDetail = actions.find((a) => a.id === actionDetailId) ?? null;
  const actionEmployee = actionDetail ? employees.find((e) => e.id === actionDetail.employee_id) : null;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <Users className="h-6 w-6 text-primary" /> HR
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Employees, contractors and HR compliance obligations.</p>
        </div>
        <Button onClick={() => { setCreating(true); setFormEmployee(null); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add employee
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Active employees" value={metrics.active} />
        <MetricCard label="Contractors" value={metrics.contractors} />
        <MetricCard label="New starters (30d)" value={metrics.new_starters} />
        <MetricCard label="Probation reviews" value={metrics.probation_reviews_due} tone={metrics.probation_reviews_due ? "warning" : "default"} />
        <MetricCard label="RTW outstanding" value={metrics.rtw_outstanding} tone={metrics.rtw_outstanding ? "danger" : "default"} />
        <MetricCard label="Training due" value={metrics.training_due} tone={metrics.training_due ? "warning" : "default"} />
        <MetricCard label="Policy missing" value={metrics.policy_missing} tone={metrics.policy_missing ? "warning" : "default"} />
        <MetricCard label="Open HR actions" value={metrics.open_actions} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <SectionHeader title="Employee register" description="Filter, sort and open records." />
          <Card className="mt-3 border border-border bg-card p-4 shadow-none">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="pl-9" />
              </div>
              <Select value={typeF} onValueChange={setTypeF}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                  <SelectItem value="contractor">Contractors</SelectItem>
                  <SelectItem value="consultant">Consultants</SelectItem>
                  <SelectItem value="intern">Interns</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusF} onValueChange={setStatusF}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="notice">Notice</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={deptF} onValueChange={setDeptF}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Tabs value={view} onValueChange={(v) => setView(v as "table" | "cards")}>
                <TabsList><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="cards">Cards</TabsTrigger></TabsList>
              </Tabs>
            </div>

            {filtered.length === 0 ? (
              <div className="py-10"><EmptyState title="No people match" /></div>
            ) : view === "table" ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Role</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">RTW</th>
                      <th className="px-2 py-2">Training</th>
                      <th className="px-2 py-2">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent" onClick={() => setDetailId(e.id)}>
                        <td className="px-2 py-2 font-medium">{e.full_name}</td>
                        <td className="px-2 py-2">{e.job_title}</td>
                        <td className="px-2 py-2 capitalize">{e.employment_type}</td>
                        <td className="px-2 py-2"><EmpStatusPill s={e.employment_status} /></td>
                        <td className="px-2 py-2"><RtwPill s={e.right_to_work_status} /></td>
                        <td className="px-2 py-2"><TrainingPill s={e.training_status} /></td>
                        <td className="px-2 py-2">{e.next_review_date ? <DateStatusBadge iso={e.next_review_date} label="review" /> : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {filtered.map((e) => <EmployeeCard key={e.id} employee={e} onOpen={() => setDetailId(e.id)} />)}
              </div>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader title="Open HR actions" description="Right-to-work, training, reviews and more." />
          <div className="mt-3 space-y-2">
            {openHrActions(state).length === 0 ? (
              <EmptyState title="No open actions" />
            ) : (
              openHrActions(state).slice(0, 12).map((a) => (
                <Card key={a.id} onClick={() => setActionDetailId(a.id)} className="flex cursor-pointer flex-col gap-1.5 border border-border bg-card p-3 shadow-none hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-foreground">{a.title}</p>
                    <StatusPill tone={a.priority === "high" ? "danger" : a.priority === "medium" ? "warning" : "info"}>{a.priority}</StatusPill>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{a.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="neutral">{HR_ACTION_LABEL[a.action_type]}</StatusPill>
                    {a.due_date && <DateStatusBadge iso={a.due_date} label="due" />}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-8 rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3 text-[12px] text-muted-foreground">
        <Info className="mr-1 inline h-3.5 w-3.5" /> {disclaimerHr}
      </p>

      {/* Employee detail */}
      <DetailDrawer open={!!detail} onOpenChange={(v) => !v && setDetailId(null)} title={detail?.full_name ?? ""}>
        {detail && (
          <EmployeeDetail
            employee={detail}
            actions={employeeActions}
            onEdit={() => { setFormEmployee(detail); setCreating(false); }}
            onArchive={() => { archiveEmployee(detail.id); toast.success("Archived"); setDetailId(null); }}
            onDelete={() => setConfirmDelete(detail.id)}
            onAddAction={() => setCreatingAction(detail.id)}
            onOpenAction={(id) => setActionDetailId(id)}
            onUpdate={(patch) => { upsertEmployee({ ...detail, ...patch }); toast.success("Updated"); }}
            onAskJova={() => {
              const cid = createConversation(`About ${detail.full_name}`);
              appendMessage({
                conversation_id: cid, sender: "user",
                content: `Give me a status update on ${detail.full_name}.`,
                reference_type: "employee", reference_id: detail.id, suggested_action: null,
              });
              navigate({ to: "/jova", search: { c: cid } });
            }}
          />
        )}
      </DetailDrawer>

      {/* Action detail */}
      <DetailDrawer open={!!actionDetail} onOpenChange={(v) => !v && setActionDetailId(null)} title={actionDetail?.title ?? ""}>
        {actionDetail && actionEmployee && (
          <HrActionDetail
            action={actionDetail}
            employee={actionEmployee}
            onComplete={() => { completeHrAction(actionDetail.id); toast.success("Action completed"); setActionDetailId(null); }}
            onReopen={() => { reopenHrAction(actionDetail.id); toast.success("Reopened"); }}
            onDefer={(d) => { deferHrAction(actionDetail.id, d); toast.success("Deferred"); setActionDetailId(null); }}
            onDelete={() => { deleteHrAction(actionDetail.id); toast.success("Deleted"); setActionDetailId(null); }}
            onOpenEmployee={() => { setActionDetailId(null); setDetailId(actionEmployee.id); }}
          />
        )}
      </DetailDrawer>

      {(creating || formEmployee) && (
        <EmployeeForm
          initial={formEmployee ?? undefined}
          onCancel={() => { setCreating(false); setFormEmployee(null); }}
          onSave={(e) => { upsertEmployee(e); toast.success("Employee saved"); setCreating(false); setFormEmployee(null); setDetailId(e.id); }}
        />
      )}

      {creatingAction && (
        <HrActionForm
          initial={newHrActionDraft(creatingAction)}
          employee={employees.find((e) => e.id === creatingAction)!}
          onCancel={() => setCreatingAction(null)}
          onSave={(a) => { upsertHrAction(a); toast.success("HR action added"); setCreatingAction(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this employee?" description="This will also delete their HR actions." destructive confirmLabel="Delete"
        onConfirm={() => { if (confirmDelete) { deleteEmployee(confirmDelete); toast.success("Deleted"); setConfirmDelete(null); setDetailId(null); } }}
      />
    </div>
  );
}

function EmpStatusPill({ s }: { s: EmploymentStatus }) {
  const tone: Tone = s === "active" ? "success" : s === "probation" ? "info" : s === "notice" ? "warning" : "neutral";
  return <StatusPill tone={tone}>{s}</StatusPill>;
}
function RtwPill({ s }: { s: Employee["right_to_work_status"] }) {
  const tone: Tone = s === "verified" ? "success" : s === "outstanding" ? "danger" : s === "expired" ? "danger" : "neutral";
  return <StatusPill tone={tone}>{s.replace("_", " ")}</StatusPill>;
}
function TrainingPill({ s }: { s: Employee["training_status"] }) {
  const tone: Tone = s === "complete" ? "success" : s === "outstanding" ? "warning" : "danger";
  return <StatusPill tone={tone}>{s}</StatusPill>;
}

function EmployeeCard({ employee, onOpen }: { employee: Employee; onOpen: () => void }) {
  return (
    <Card onClick={onOpen} className="flex cursor-pointer flex-col gap-2 border border-border bg-card p-4 shadow-none hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-foreground">{employee.full_name}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{employee.job_title} · {employee.department}</p>
        </div>
        <EmpStatusPill s={employee.employment_status} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <RtwPill s={employee.right_to_work_status} />
        <TrainingPill s={employee.training_status} />
        {employee.policy_acknowledgement_status === "outstanding" && <StatusPill tone="warning">Handbook</StatusPill>}
      </div>
    </Card>
  );
}

function EmployeeDetail({
  employee, actions,
  onEdit, onArchive, onDelete, onAddAction, onOpenAction, onUpdate, onAskJova,
}: {
  employee: Employee; actions: HrAction[];
  onEdit: () => void; onArchive: () => void; onDelete: () => void; onAddAction: () => void;
  onOpenAction: (id: string) => void; onUpdate: (patch: Partial<Employee>) => void; onAskJova: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <EmpStatusPill s={employee.employment_status} />
        <StatusPill tone="neutral">{employee.employment_type}</StatusPill>
        <RtwPill s={employee.right_to_work_status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <InfoRow label="Role" value={employee.job_title} />
        <InfoRow label="Department" value={employee.department} />
        <InfoRow label="Start date" value={formatDate(employee.start_date)} />
        <InfoRow label="Probation ends" value={employee.probation_end_date ? formatDate(employee.probation_end_date) : "-"} />
        <InfoRow label="Next review" value={employee.next_review_date ? <DateStatusBadge iso={employee.next_review_date} label="review" /> : "-"} />
        <InfoRow label="Contract" value={<span className="capitalize">{employee.contract_status}</span>} />
        <InfoRow label="Training" value={<TrainingPill s={employee.training_status} />} />
        <InfoRow label="Handbook" value={employee.policy_acknowledgement_status === "complete" ? "Complete" : "Outstanding"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => onUpdate({ right_to_work_status: employee.right_to_work_status === "verified" ? "outstanding" : "verified" })}>
          Toggle RTW
        </Button>
        <Button size="sm" variant="outline" onClick={() => onUpdate({ training_status: employee.training_status === "complete" ? "outstanding" : "complete" })}>
          Toggle training
        </Button>
        <Button size="sm" variant="outline" onClick={() => onUpdate({ policy_acknowledgement_status: employee.policy_acknowledgement_status === "complete" ? "outstanding" : "complete" })}>
          Toggle handbook
        </Button>
        <Button size="sm" variant="outline" onClick={() => onUpdate({ next_review_date: new Date(Date.now() + 90 * 86400000).toISOString() })}>
          Record review
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">HR actions</p>
          <Button size="sm" variant="outline" onClick={onAddAction}><Plus className="mr-1 h-3.5 w-3.5" /> Add action</Button>
        </div>
        <div className="mt-2 space-y-1.5">
          {actions.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No actions recorded.</p>
          ) : actions.map((a) => (
            <button key={a.id} onClick={() => onOpenAction(a.id)} className="flex w-full items-center justify-between gap-2 rounded-md border border-border p-2 text-left text-[13px] hover:bg-accent">
              <span>
                <span className="font-medium">{a.title}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">{HR_ACTION_LABEL[a.action_type]}</span>
              </span>
              <StatusPill tone={a.status === "completed" ? "success" : a.status === "deferred" ? "info" : "warning"}>{a.status}</StatusPill>
            </button>
          ))}
        </div>
      </div>

      {employee.notes && (<div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 text-[13px]">{employee.notes}</p></div>)}
      <p className="text-[11px] text-muted-foreground">Updated {formatRelative(employee.updated_at)}</p>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="outline" onClick={onArchive}><Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>
        <Button size="sm" variant="ghost" onClick={onAskJova}><MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask Jova</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}

function HrActionDetail({
  action, employee, onComplete, onReopen, onDefer, onDelete, onOpenEmployee,
}: {
  action: HrAction; employee: Employee;
  onComplete: () => void; onReopen: () => void; onDefer: (iso: string) => void; onDelete: () => void; onOpenEmployee: () => void;
}) {
  const [defer, setDefer] = useState("");
  return (
    <div className="space-y-4">
      <button className="flex items-center gap-2 rounded-md border border-border p-2 text-left text-[13px] hover:bg-accent" onClick={onOpenEmployee}>
        <span className="text-muted-foreground">Employee:</span>
        <span className="font-medium">{employee.full_name}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{employee.job_title}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={action.priority === "high" ? "danger" : action.priority === "medium" ? "warning" : "info"}>{action.priority}</StatusPill>
        <StatusPill tone={action.status === "completed" ? "success" : action.status === "deferred" ? "info" : "warning"}>{action.status}</StatusPill>
        <StatusPill tone="neutral">{HR_ACTION_LABEL[action.action_type]}</StatusPill>
      </div>
      <p className="text-[13px]">{action.description}</p>
      {action.due_date && <DateStatusBadge iso={action.due_date} label="due" />}
      {action.notes && <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 text-[13px]">{action.notes}</p></div>}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {action.status !== "completed" ? (
          <Button size="sm" onClick={onComplete}><Check className="mr-1 h-3.5 w-3.5" /> Mark complete</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onReopen}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Reopen</Button>
        )}
        <div className="flex items-center gap-1">
          <Input type="date" value={defer} onChange={(e) => setDefer(e.target.value)} className="h-8 w-[150px]" />
          <Button size="sm" variant="outline" disabled={!defer} onClick={() => defer && onDefer(defer)}><CalendarClock className="mr-1 h-3.5 w-3.5" /> Defer</Button>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}

function EmployeeForm({ initial, onCancel, onSave }: { initial?: Employee; onCancel: () => void; onSave: (e: Employee) => void }) {
  const [e, setE] = useState<Employee>(initial ?? newEmployeeDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const errs: Record<string, string> = {};
    if (!e.full_name.trim()) errs.full_name = "Full name required.";
    if (!e.job_title.trim()) errs.job_title = "Job title required.";
    if (!e.start_date) errs.start_date = "Start date required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(e);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Edit employee" : "Add employee"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required error={errors.full_name}><Input value={e.full_name} onChange={(ev) => setE({ ...e, full_name: ev.target.value })} /></Field>
          <Field label="Job title" required error={errors.job_title}><Input value={e.job_title} onChange={(ev) => setE({ ...e, job_title: ev.target.value })} /></Field>
          <Field label="Department"><Input value={e.department} onChange={(ev) => setE({ ...e, department: ev.target.value })} /></Field>
          <Field label="Employment type">
            <Select value={e.employment_type} onValueChange={(v) => setE({ ...e, employment_type: v as EmploymentType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="contractor">Contractor</SelectItem><SelectItem value="consultant">Consultant</SelectItem><SelectItem value="intern">Intern</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={e.employment_status} onValueChange={(v) => setE({ ...e, employment_status: v as EmploymentStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="probation">Probation</SelectItem><SelectItem value="notice">Notice</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Start date" required error={errors.start_date}><Input type="date" value={e.start_date.slice(0, 10)} onChange={(ev) => setE({ ...e, start_date: ev.target.value })} /></Field>
          <Field label="Probation end"><Input type="date" value={e.probation_end_date?.slice(0, 10) ?? ""} onChange={(ev) => setE({ ...e, probation_end_date: ev.target.value || null })} /></Field>
          <Field label="Next review"><Input type="date" value={e.next_review_date?.slice(0, 10) ?? ""} onChange={(ev) => setE({ ...e, next_review_date: ev.target.value || null })} /></Field>
          <Field label="Contract status">
            <Select value={e.contract_status} onValueChange={(v) => setE({ ...e, contract_status: v as Employee["contract_status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="signed">Signed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="missing">Missing</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Right to work">
            <Select value={e.right_to_work_status} onValueChange={(v) => setE({ ...e, right_to_work_status: v as Employee["right_to_work_status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="verified">Verified</SelectItem><SelectItem value="outstanding">Outstanding</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="not_required">Not required</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="RTW expiry"><Input type="date" value={e.right_to_work_expiry?.slice(0, 10) ?? ""} onChange={(ev) => setE({ ...e, right_to_work_expiry: ev.target.value || null })} /></Field>
          <Field label="Training">
            <Select value={e.training_status} onValueChange={(v) => setE({ ...e, training_status: v as Employee["training_status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="complete">Complete</SelectItem><SelectItem value="outstanding">Outstanding</SelectItem><SelectItem value="overdue">Overdue</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Handbook acknowledged">
            <Select value={e.policy_acknowledgement_status} onValueChange={(v) => setE({ ...e, policy_acknowledgement_status: v as Employee["policy_acknowledgement_status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="complete">Complete</SelectItem><SelectItem value="outstanding">Outstanding</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Risk level">
            <Select value={e.risk_level} onValueChange={(v) => setE({ ...e, risk_level: v as Employee["risk_level"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-[13px]"><Switch checked={e.emergency_contact_recorded} onCheckedChange={(v) => setE({ ...e, emergency_contact_recorded: !!v })} /> Emergency contact recorded</label>
          <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={e.notes} onChange={(ev) => setE({ ...e, notes: ev.target.value })} /></Field></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={save}>Save employee</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HrActionForm({ initial, employee, onCancel, onSave }: {
  initial: HrAction; employee: Employee; onCancel: () => void; onSave: (a: HrAction) => void;
}) {
  const [a, setA] = useState<HrAction>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const errs: Record<string, string> = {};
    if (!a.title.trim()) errs.title = "Title required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(a);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New HR action for {employee.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Type">
            <Select value={a.action_type} onValueChange={(v) => setA({ ...a, action_type: v as HrActionType, title: HR_ACTION_LABEL[v as HrActionType] + " - " + employee.full_name })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(HR_ACTION_LABEL) as HrActionType[]).map((k) => <SelectItem key={k} value={k}>{HR_ACTION_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Title" required error={errors.title}><Input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={2} value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select value={a.priority} onValueChange={(v) => setA({ ...a, priority: v as HrAction["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Due date"><Input type="date" value={a.due_date?.slice(0, 10) ?? ""} onChange={(e) => setA({ ...a, due_date: e.target.value || null })} /></Field>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={save}>Add action</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}