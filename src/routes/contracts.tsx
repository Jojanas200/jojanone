import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  upsertContract,
  archiveContract,
  deleteContract,
  completeContractAction,
  newContractDraft,
  createConversation,
  appendMessage,
  upsertEntity,
  newEntityDraft,
} from "@/data/store";
import { contractIsExpiring, contractIssues, contractMetrics, formatGBP } from "@/data/business-selectors";
import { formatDate, formatRelative } from "@/data/selectors";
import type { Contract, ContractStatus, ContractType, EntityType } from "@/data/types";
import {
  Button, Card, Field, Input, InfoRow, SectionHeader,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, DateStatusBadge,
} from "@/components/business/shared";
import { MetricCard } from "@/components/core/MetricCard";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Plus, Search, Pencil, Archive, Trash2, MessageSquare, Copy, Check, Link as LinkIcon, Printer, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contracts")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : undefined }),
  head: () => ({
    meta: [
      { title: "Contracts - Jojan One" },
      { name: "description", content: "Contract register and lifecycle tracker." },
    ],
  }),
  component: ContractsPage,
});

const TYPE_LABEL: Record<ContractType, string> = {
  customer: "Customer", supplier: "Supplier", employment: "Employment", contractor: "Contractor",
  software: "Software", office: "Office", dpa: "Data processing", insurance: "Insurance", nda: "NDA", other: "Other",
};

const STATUS_TONE: Record<ContractStatus, Tone> = {
  active: "success", draft: "info", expired: "danger", archived: "neutral", pending_signature: "warning",
};

function ContractsPage() {
  const state = useCoreData((s) => s);
  const contracts = state.contracts;
  const entities = state.business_entities;
  const { c: openId } = Route.useSearch();
  const navigate = useNavigate();

  const [view, setView] = useState<"table" | "cards">("table");
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [riskF, setRiskF] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(openId ?? null);
  const [formContract, setFormContract] = useState<Contract | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Contract | null>(null);

  const metrics = contractMetrics(state);

  const filtered = useMemo(() => {
    return contracts
      .filter((c) => typeF === "all" || c.contract_type === typeF)
      .filter((c) => statusF === "all" || c.status === statusF)
      .filter((c) => riskF === "all" || c.risk_level === riskF)
      .filter((c) => {
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return c.title.toLowerCase().includes(t) || c.counterparty.toLowerCase().includes(t);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [contracts, q, typeF, statusF, riskF]);

  const detail = contracts.find((c) => c.id === detailId) ?? null;
  const detailEntity = detail?.entity_id ? entities.find((e) => e.id === detail.entity_id) ?? null : null;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <FileText className="h-6 w-6 text-primary" /> Contracts
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Register, renewal tracking and next-action reminders.</p>
        </div>
        <Button onClick={() => { setCreating(true); setFormContract(null); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add contract
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total contracts" value={metrics.total} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Drafts" value={metrics.drafts} />
        <MetricCard label="Expiring in 30 days" value={metrics.expiring} tone={metrics.expiring ? "warning" : "default"} />
        <MetricCard label="High risk" value={metrics.high_risk} tone={metrics.high_risk ? "danger" : "default"} />
        <MetricCard label="Recorded value" value={formatGBP(metrics.total_value)} />
      </div>

      <Card className="mt-6 border border-border bg-card p-4 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contracts…" className="pl-9" />
          </div>
          <Select value={typeF} onValueChange={setTypeF}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(TYPE_LABEL) as ContractType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_signature">Pending signature</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskF} onValueChange={setRiskF}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any risk</SelectItem>
              <SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "cards")}>
            <TabsList><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="cards">Cards</TabsTrigger></TabsList>
          </Tabs>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10"><EmptyState title="No contracts match" description="Try clearing filters or add a new contract." /></div>
        ) : view === "table" ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Counterparty</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Value</th>
                  <th className="px-2 py-2">Next</th>
                  <th className="px-2 py-2">End</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent" onClick={() => setDetailId(c.id)}>
                    <td className="px-2 py-2 font-medium">{c.title}</td>
                    <td className="px-2 py-2">{c.counterparty}</td>
                    <td className="px-2 py-2">{TYPE_LABEL[c.contract_type]}</td>
                    <td className="px-2 py-2"><StatusPill tone={STATUS_TONE[c.status]}>{c.status.replace("_", " ")}</StatusPill></td>
                    <td className="px-2 py-2">{c.value ? formatGBP(c.value) : "-"}</td>
                    <td className="px-2 py-2">{c.next_action_date ? <DateStatusBadge iso={c.next_action_date} label="due" /> : "-"}</td>
                    <td className="px-2 py-2">{c.end_date ? formatDate(c.end_date) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <ContractCard key={c.id} contract={c} onOpen={() => setDetailId(c.id)} />
            ))}
          </div>
        )}
      </Card>

      <DetailDrawer open={!!detail} onOpenChange={(v) => !v && setDetailId(null)} title={detail?.title ?? ""}>
        {detail && (
          <ContractDetail
            contract={detail}
            linkedEntity={detailEntity}
            allEntities={entities}
            onEdit={() => { setFormContract(detail); setCreating(false); }}
            onArchive={() => { archiveContract(detail.id); toast.success("Contract archived"); setDetailId(null); }}
            onDelete={() => setConfirmDelete(detail.id)}
            onDuplicate={() => {
              const dup = { ...detail, id: newContractDraft().id, title: `${detail.title} (copy)`, status: "draft" as ContractStatus };
              upsertContract(dup);
              toast.success("Contract duplicated");
              setDetailId(dup.id);
            }}
            onCompleteAction={() => { completeContractAction(detail.id); toast.success("Action completed"); }}
            onOpenEntity={(id) => navigate({ to: "/business-map", search: { e: id } })}
            onLinkEntity={(id) => { upsertContract({ ...detail, entity_id: id }); toast.success("Linked to relationship"); }}
            onCreateEntity={() => {
              const e = newEntityDraft(detail.counterparty || "New relationship", (detail.contract_type as EntityType) === "supplier" ? "supplier" : "customer");
              e.relationship = `Counterparty on ${detail.title}`;
              upsertEntity(e);
              upsertContract({ ...detail, entity_id: e.id });
              toast.success("Relationship created and linked");
              navigate({ to: "/business-map", search: { e: e.id } });
            }}
            onAskJova={() => {
              const cid = createConversation(`About: ${detail.title}`);
              appendMessage({
                conversation_id: cid, sender: "user",
                content: `Explain the ${detail.title} contract.`,
                reference_type: "contract", reference_id: detail.id, suggested_action: null,
              });
              navigate({ to: "/jova", search: { c: cid } });
            }}
            onPrint={() => setPrinting(detail)}
          />
        )}
      </DetailDrawer>

      {(creating || formContract) && (
        <ContractForm
          initial={formContract ?? undefined}
          entities={entities}
          onCancel={() => { setCreating(false); setFormContract(null); }}
          onSave={(c) => {
            upsertContract(c);
            toast.success("Contract saved");
            setCreating(false); setFormContract(null); setDetailId(c.id);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this contract?" description="This cannot be undone." destructive confirmLabel="Delete"
        onConfirm={() => { if (confirmDelete) { deleteContract(confirmDelete); toast.success("Deleted"); setConfirmDelete(null); setDetailId(null); } }}
      />

      {printing && <PrintView contract={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

function ContractCard({ contract, onOpen }: { contract: Contract; onOpen: () => void }) {
  const issues = contractIssues(contract);
  return (
    <Card onClick={onOpen} className="flex cursor-pointer flex-col gap-2 border border-border bg-card p-4 shadow-none hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">{contract.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{contract.counterparty}</p>
        </div>
        <StatusPill tone={STATUS_TONE[contract.status]}>{contract.status.replace("_", " ")}</StatusPill>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <StatusPill tone="neutral">{TYPE_LABEL[contract.contract_type]}</StatusPill>
        {contract.value > 0 && <StatusPill tone="neutral">{formatGBP(contract.value)}</StatusPill>}
        {contract.end_date && <DateStatusBadge iso={contract.end_date} label="ends" />}
        {contract.risk_level === "high" && <StatusPill tone="danger">High risk</StatusPill>}
      </div>
      {issues.length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[12px] text-[oklch(0.45_0.15_75)]">
          <AlertTriangle className="h-3.5 w-3.5" /> {issues[0]}
        </div>
      )}
    </Card>
  );
}

function ContractDetail({
  contract, linkedEntity, allEntities,
  onEdit, onArchive, onDelete, onDuplicate, onCompleteAction, onOpenEntity, onLinkEntity, onCreateEntity, onAskJova, onPrint,
}: {
  contract: Contract; linkedEntity: import("@/data/types").BusinessEntity | null;
  allEntities: import("@/data/types").BusinessEntity[];
  onEdit: () => void; onArchive: () => void; onDelete: () => void; onDuplicate: () => void; onCompleteAction: () => void;
  onOpenEntity: (id: string) => void; onLinkEntity: (id: string) => void; onCreateEntity: () => void;
  onAskJova: () => void; onPrint: () => void;
}) {
  const issues = contractIssues(contract);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_TONE[contract.status]}>{contract.status.replace("_", " ")}</StatusPill>
        <StatusPill tone="neutral">{TYPE_LABEL[contract.contract_type]}</StatusPill>
        <StatusPill tone={contract.risk_level === "high" ? "danger" : contract.risk_level === "medium" ? "warning" : "info"}>{contract.risk_level} risk</StatusPill>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <InfoRow label="Counterparty" value={contract.counterparty} />
        <InfoRow label="Owner" value={contract.owner || "-"} />
        <InfoRow label="Value" value={contract.value ? formatGBP(contract.value) : "-"} />
        <InfoRow label="Currency" value={contract.currency} />
        <InfoRow label="Start" value={contract.start_date ? formatDate(contract.start_date) : "-"} />
        <InfoRow label="End" value={contract.end_date ? formatDate(contract.end_date) : "-"} />
        <InfoRow label="Renewal" value={contract.renewal_date ? formatDate(contract.renewal_date) : "-"} />
        <InfoRow label="Notice period" value={contract.notice_period_days ? `${contract.notice_period_days} days` : "-"} />
      </div>
      {issues.length > 0 && (
        <div className="rounded-md border border-[oklch(0.9_0.06_75)] bg-[oklch(0.98_0.04_85)] p-3 text-[13px]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[oklch(0.45_0.15_75)]">Contract alerts</p>
          <ul className="mt-1 list-disc pl-4">
            {issues.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      )}
      {contract.key_terms && (
        <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Key terms</p><p className="mt-1 text-[13px]">{contract.key_terms}</p></div>
      )}
      {contract.obligations && (
        <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Obligations</p><p className="mt-1 text-[13px]">{contract.obligations}</p></div>
      )}
      {contract.next_action && (
        <div className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next action</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[13px]">{contract.next_action}</p>
            <Button size="sm" variant="outline" onClick={onCompleteAction}><Check className="mr-1 h-3.5 w-3.5" /> Complete</Button>
          </div>
          {contract.next_action_date && <div className="mt-1"><DateStatusBadge iso={contract.next_action_date} label="due" /></div>}
        </div>
      )}
      {linkedEntity ? (
        <Card className="flex items-center justify-between gap-3 border border-border bg-[oklch(0.98_0.003_260)] p-3 shadow-none">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Linked relationship</p>
            <p className="text-[13px] font-medium">{linkedEntity.name}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpenEntity(linkedEntity.id)}>Open</Button>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2 rounded-md border border-dashed border-border p-3 text-[13px]">
          <span className="text-muted-foreground">Not linked to a relationship.</span>
          <Select onValueChange={(v) => onLinkEntity(v)}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Link existing…" /></SelectTrigger>
            <SelectContent>{allEntities.filter((e) => e.status !== "archived").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onCreateEntity}><LinkIcon className="mr-1 h-3.5 w-3.5" /> Create relationship</Button>
        </div>
      )}
      {contract.notes && (<div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 text-[13px]">{contract.notes}</p></div>)}
      <p className="text-[11px] text-muted-foreground">Updated {formatRelative(contract.updated_at)}</p>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}><Copy className="mr-1 h-3.5 w-3.5" /> Duplicate</Button>
        <Button size="sm" variant="outline" onClick={onArchive}><Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>
        <Button size="sm" variant="outline" onClick={onPrint}><Printer className="mr-1 h-3.5 w-3.5" /> Print summary</Button>
        <Button size="sm" variant="ghost" onClick={onAskJova}><MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask Jova</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}

function ContractForm({ initial, entities, onCancel, onSave }: {
  initial?: Contract; entities: import("@/data/types").BusinessEntity[]; onCancel: () => void; onSave: (c: Contract) => void;
}) {
  const [c, setC] = useState<Contract>(initial ?? newContractDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const errs: Record<string, string> = {};
    if (!c.title.trim()) errs.title = "Title is required.";
    if (!c.counterparty.trim()) errs.counterparty = "Counterparty is required.";
    if (c.value < 0) errs.value = "Value cannot be negative.";
    if (c.start_date && c.end_date && new Date(c.start_date).getTime() > new Date(c.end_date).getTime()) errs.end_date = "End date must be after start date.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(c);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Edit contract" : "Add contract"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" required error={errors.title} ><Input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} /></Field>
          <Field label="Counterparty" required error={errors.counterparty}><Input value={c.counterparty} onChange={(e) => setC({ ...c, counterparty: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={c.contract_type} onValueChange={(v) => setC({ ...c, contract_type: v as ContractType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(TYPE_LABEL) as ContractType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={c.status} onValueChange={(v) => setC({ ...c, status: v as ContractStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_signature">Pending signature</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Value" error={errors.value}><Input type="number" value={c.value} onChange={(e) => setC({ ...c, value: Number(e.target.value) || 0 })} /></Field>
          <Field label="Currency">
            <Select value={c.currency} onValueChange={(v) => setC({ ...c, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="GBP">GBP</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Start date"><Input type="date" value={c.start_date?.slice(0, 10) ?? ""} onChange={(e) => setC({ ...c, start_date: e.target.value || null })} /></Field>
          <Field label="End date" error={errors.end_date}><Input type="date" value={c.end_date?.slice(0, 10) ?? ""} onChange={(e) => setC({ ...c, end_date: e.target.value || null })} /></Field>
          <Field label="Renewal date"><Input type="date" value={c.renewal_date?.slice(0, 10) ?? ""} onChange={(e) => setC({ ...c, renewal_date: e.target.value || null })} /></Field>
          <Field label="Notice period (days)"><Input type="number" value={c.notice_period_days ?? ""} onChange={(e) => setC({ ...c, notice_period_days: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Owner"><Input value={c.owner} onChange={(e) => setC({ ...c, owner: e.target.value })} /></Field>
          <Field label="Risk">
            <Select value={c.risk_level} onValueChange={(v) => setC({ ...c, risk_level: v as Contract["risk_level"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Linked relationship">
            <Select value={c.entity_id ?? "none"} onValueChange={(v) => setC({ ...c, entity_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {entities.filter((e) => e.status !== "archived").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="col-span-2"><Field label="Key terms"><Textarea rows={2} value={c.key_terms} onChange={(e) => setC({ ...c, key_terms: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Obligations"><Textarea rows={2} value={c.obligations} onChange={(e) => setC({ ...c, obligations: e.target.value })} /></Field></div>
          <Field label="Next action"><Input value={c.next_action} onChange={(e) => setC({ ...c, next_action: e.target.value })} /></Field>
          <Field label="Next action date"><Input type="date" value={c.next_action_date?.slice(0, 10) ?? ""} onChange={(e) => setC({ ...c, next_action_date: e.target.value || null })} /></Field>
          <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} /></Field></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={save}>Save contract</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrintView({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto print:!max-h-none print:!max-w-none print:!shadow-none">
        <div className="print:p-6" id="contract-print">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Jojan One · Contract Summary</p>
              <h2 className="text-[20px] font-semibold text-foreground">{contract.title}</h2>
            </div>
            <p className="text-[12px] text-muted-foreground">Generated {formatDate(new Date().toISOString())}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <InfoRow label="Counterparty" value={contract.counterparty} />
            <InfoRow label="Type" value={TYPE_LABEL[contract.contract_type]} />
            <InfoRow label="Status" value={contract.status} />
            <InfoRow label="Value" value={contract.value ? formatGBP(contract.value) : "-"} />
            <InfoRow label="Start" value={contract.start_date ? formatDate(contract.start_date) : "-"} />
            <InfoRow label="End" value={contract.end_date ? formatDate(contract.end_date) : "-"} />
            <InfoRow label="Renewal" value={contract.renewal_date ? formatDate(contract.renewal_date) : "-"} />
            <InfoRow label="Notice" value={contract.notice_period_days ? `${contract.notice_period_days} days` : "-"} />
            <InfoRow label="Owner" value={contract.owner || "-"} />
            <InfoRow label="Risk" value={contract.risk_level} />
          </div>
          <Section title="Key terms" body={contract.key_terms} />
          <Section title="Obligations" body={contract.obligations} />
          <Section title="Next actions" body={contract.next_action ? `${contract.next_action}${contract.next_action_date ? " (due " + formatDate(contract.next_action_date) + ")" : ""}` : "None recorded."} />
          <p className="mt-8 border-t border-border pt-3 text-[11px] italic text-muted-foreground">
            This summary is generated for information only. It does not constitute legal advice. Where professional judgement is required, Jojan One will recommend expert support.
          </p>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Print / PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-[13px]">{body || "-"}</p>
    </div>
  );
}

// silence unused
void contractIsExpiring;