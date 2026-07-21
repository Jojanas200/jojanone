import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  updateBusinessProfile,
  upsertEntity,
  archiveEntity,
  restoreEntity,
  deleteEntity,
  newEntityDraft,
  createConversation,
  appendMessage,
} from "@/data/store";
import { entityMetrics } from "@/data/business-selectors";
import { formatDate, formatRelative } from "@/data/selectors";
import type { BusinessEntity, EntityType, Contract } from "@/data/types";
import {
  Button,
  Card,
  Field,
  Input,
  InfoRow,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  DateStatusBadge,
  ModuleSummaryCard,
} from "@/components/business/shared";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Map,
  Plus,
  Search,
  Building2,
  Users,
  Truck,
  Landmark,
  Wallet,
  Handshake,
  MessageSquare,
  Pencil,
  Archive,
  Trash2,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/business-map")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    e: typeof s.e === "string" ? s.e : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Business Map - Jojan One" },
      { name: "description", content: "See your business structure clearly." },
    ],
  }),
  component: BusinessMapPage,
});

const TYPE_LABEL: Record<EntityType, string> = {
  customer: "Customer",
  supplier: "Supplier",
  employee: "Employee",
  contractor: "Contractor",
  adviser: "Adviser",
  regulator: "Regulator",
  partner: "Business partner",
  insurer: "Insurer",
  bank: "Bank / finance",
};

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  review_due: "warning",
  at_risk: "danger",
  archived: "neutral",
  missing_info: "info",
};

function BusinessMapPage() {
  const state = useCoreData((s) => s);
  const profile = state.business_profile;
  const entities = state.business_entities;
  const contracts = state.contracts;
  const { e: openEntity } = Route.useSearch();
  const navigate = useNavigate();

  const [view, setView] = useState<"map" | "category" | "list">("category");
  const [detailId, setDetailId] = useState<string | null>(openEntity ?? null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [formEntity, setFormEntity] = useState<BusinessEntity | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const metrics = entityMetrics(state);

  const filtered = useMemo(() => {
    return entities
      .filter((e) => typeFilter === "all" || e.entity_type === typeFilter)
      .filter((e) => statusFilter === "all" || e.status === statusFilter)
      .filter((e) => riskFilter === "all" || e.risk_level === riskFilter)
      .filter((e) => {
        if (!q.trim()) return true;
        const t = q.toLowerCase();
        return e.name.toLowerCase().includes(t) || e.relationship.toLowerCase().includes(t) || e.contact_name.toLowerCase().includes(t);
      });
  }, [entities, q, typeFilter, statusFilter, riskFilter]);

  const detail = entities.find((e) => e.id === detailId) ?? null;
  const detailContract = detail?.contract_id ? contracts.find((c) => c.id === detail.contract_id) ?? null : null;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <Map className="h-6 w-6 text-primary" /> Business Map
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{profile.business_name}</span>
            <span>·</span>
            <span>{profile.business_type}</span>
            <span>·</span>
            <span>Profile complete {profile.profile_completion}%</span>
            <span>·</span>
            <span>Last updated {formatRelative(profile.updated_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditingProfile(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit business profile
          </Button>
          <Button onClick={() => { setCreating(true); setFormEntity(null); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add relationship
          </Button>
        </div>
      </div>

      <Card className="mt-6 border border-border bg-card p-5 shadow-none">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <InfoRow label="Company number" value={profile.company_number} />
          <InfoRow label="Industry" value={profile.industry} />
          <InfoRow label="Incorporated" value={formatDate(profile.incorporation_date)} />
          <InfoRow label="FYE" value={profile.financial_year_end} />
          <InfoRow label="Registered address" value={profile.registered_address} />
          <InfoRow label="Trading address" value={profile.trading_address} />
          <InfoRow label="Revenue" value={profile.annual_revenue_band} />
          <InfoRow
            label="Status"
            value={
              <div className="flex flex-wrap gap-1">
                {profile.vat_registered && <StatusPill tone="info">VAT</StatusPill>}
                {profile.employer_registered && <StatusPill tone="info">Employer</StatusPill>}
                {profile.processes_personal_data && <StatusPill tone="warning">Data</StatusPill>}
                {profile.trades_internationally && <StatusPill tone="warning">Intl</StatusPill>}
              </div>
            }
          />
        </div>
      </Card>

      <div className="mt-8">
        <SectionHeader title="Map insights" description="Live signals across your relationships." />
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <ModuleSummaryCard title="Reviews approaching" value={metrics.reviews_due} tone={metrics.reviews_due ? "warning" : "success"} />
          <ModuleSummaryCard title="At-risk relationships" value={metrics.at_risk} tone={metrics.at_risk ? "danger" : "success"} />
          <ModuleSummaryCard title="Missing information" value={metrics.missing} tone={metrics.missing ? "info" : "success"} />
          <ModuleSummaryCard
            title="Supplier dependency"
            value={`${entities.filter((e) => e.entity_type === "supplier" && e.importance === "high" && e.status !== "archived").length} high`}
            tone="info"
          />
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "map" | "category" | "list")} className="mt-8">
        <TabsList>
          <TabsTrigger value="map">Relationship Map</TabsTrigger>
          <TabsTrigger value="category">Category View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          <RelationshipMap entities={entities} businessName={profile.business_name} onOpen={setDetailId} />
        </TabsContent>

        <TabsContent value="category" className="mt-4 space-y-6">
          {(["customer", "supplier", "employee", "contractor", "adviser", "regulator", "insurer", "bank"] as EntityType[]).map((t) => {
            const items = entities.filter((e) => e.entity_type === t && e.status !== "archived");
            if (!items.length) return null;
            const reviews = items.filter((i) => i.status === "review_due").length;
            const risky = items.filter((i) => i.risk_level === "high").length;
            return (
              <div key={t}>
                <SectionHeader
                  title={`${TYPE_LABEL[t]}s`}
                  description={`${items.length} total · ${reviews} review${reviews === 1 ? "" : "s"} due · ${risky} high-risk`}
                />
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((e) => (
                    <EntityCard key={e.id} entity={e} onClick={() => setDetailId(e.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="border border-border bg-card p-4 shadow-none">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search relationships…" className="pl-9" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(Object.keys(TYPE_LABEL) as EntityType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="review_due">Review due</SelectItem>
                  <SelectItem value="at_risk">At risk</SelectItem>
                  <SelectItem value="missing_info">Missing info</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any risk</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <div className="py-8"><EmptyState title="No matches" description="Try clearing filters." /></div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Relationship</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Risk</th>
                      <th className="px-2 py-2">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent" onClick={() => setDetailId(e.id)}>
                        <td className="px-2 py-2 font-medium">{e.name}</td>
                        <td className="px-2 py-2">{TYPE_LABEL[e.entity_type]}</td>
                        <td className="px-2 py-2">{e.relationship}</td>
                        <td className="px-2 py-2"><StatusPill tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status.replace("_", " ")}</StatusPill></td>
                        <td className="px-2 py-2 capitalize">{e.risk_level}</td>
                        <td className="px-2 py-2">{e.review_date ? <DateStatusBadge iso={e.review_date} label="review" /> : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <DetailDrawer open={!!detail} onOpenChange={(v) => !v && setDetailId(null)} title={detail?.name ?? ""}>
        {detail && (
          <RelationshipDetail
            entity={detail}
            contract={detailContract}
            onEdit={() => { setFormEntity(detail); setCreating(false); }}
            onArchive={() => { archiveEntity(detail.id); toast.success("Relationship archived"); setDetailId(null); }}
            onRestore={() => { restoreEntity(detail.id); toast.success("Restored"); }}
            onDelete={() => setConfirmDelete(detail.id)}
            onOpenContract={(id) => navigate({ to: "/contracts", search: { c: id } })}
            onAskJova={() => {
              const cid = createConversation(`About ${detail.name}`);
              appendMessage({
                conversation_id: cid, sender: "user",
                content: `Tell me about our relationship with ${detail.name}.`,
                reference_type: "entity", reference_id: detail.id, suggested_action: null,
              });
              navigate({ to: "/jova", search: { c: cid } });
            }}
          />
        )}
      </DetailDrawer>

      {(creating || formEntity) && (
        <EntityForm
          initial={formEntity ?? undefined}
          onCancel={() => { setCreating(false); setFormEntity(null); }}
          onSave={(e) => {
            upsertEntity(e);
            toast.success("Relationship saved");
            setCreating(false); setFormEntity(null); setDetailId(e.id);
          }}
        />
      )}

      <ProfileEditor open={editingProfile} onClose={() => setEditingProfile(false)} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this relationship?"
        description="This cannot be undone."
        destructive confirmLabel="Delete"
        onConfirm={() => { if (confirmDelete) { deleteEntity(confirmDelete); toast.success("Deleted"); setConfirmDelete(null); setDetailId(null); } }}
      />
    </div>
  );
}

function EntityCard({ entity, onClick }: { entity: BusinessEntity; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="flex cursor-pointer flex-col gap-2 border border-border bg-card p-4 shadow-none hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">{entity.name}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{entity.relationship}</p>
        </div>
        <StatusPill tone={STATUS_TONE[entity.status] ?? "neutral"}>{entity.status.replace("_", " ")}</StatusPill>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {entity.contract_id && <StatusPill tone="info">Linked contract</StatusPill>}
        {entity.importance === "high" && <StatusPill tone="neutral">High importance</StatusPill>}
        {entity.risk_level === "high" && <StatusPill tone="danger">High risk</StatusPill>}
        {entity.review_date && <DateStatusBadge iso={entity.review_date} label="review" />}
      </div>
    </Card>
  );
}

function RelationshipMap({ entities, businessName, onOpen }: { entities: BusinessEntity[]; businessName: string; onOpen: (id: string) => void }) {
  const groups: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; types: EntityType[] }> = [
    { key: "customers", label: "Customers", icon: Handshake, types: ["customer"] },
    { key: "suppliers", label: "Suppliers", icon: Truck, types: ["supplier"] },
    { key: "people", label: "People", icon: Users, types: ["employee", "contractor"] },
    { key: "advisers", label: "Advisers", icon: Building2, types: ["adviser"] },
    { key: "regulators", label: "Regulators", icon: Landmark, types: ["regulator"] },
    { key: "finance", label: "Finance & insurance", icon: Wallet, types: ["bank", "insurer"] },
  ];
  return (
    <Card className="border border-border bg-card p-6 shadow-none">
      <div className="mx-auto max-w-3xl">
        <div className="grid place-items-center rounded-lg border border-primary bg-[oklch(0.955_0.05_264)] p-4 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">Central business</p>
          <p className="mt-1 text-[18px] font-semibold text-foreground">{businessName}</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const items = entities.filter((e) => g.types.includes(e.entity_type) && e.status !== "archived");
            const Icon = g.icon;
            return (
              <Card key={g.key} className="border border-border bg-card p-4 shadow-none">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-[14px] font-semibold text-foreground">{g.label}</p>
                  <span className="ml-auto text-[12px] text-muted-foreground">{items.length}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {items.slice(0, 6).map((e) => (
                    <li key={e.id}>
                      <button onClick={() => onOpen(e.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-accent">
                        <span className={`h-1.5 w-1.5 rounded-full ${e.risk_level === "high" ? "bg-[oklch(0.6_0.22_25)]" : e.status === "review_due" ? "bg-[oklch(0.7_0.15_75)]" : "bg-[oklch(0.62_0.18_148)]"}`} />
                        <span className="truncate">{e.name}</span>
                      </button>
                    </li>
                  ))}
                  {items.length > 6 && <li className="px-2 py-1 text-[12px] text-muted-foreground">+ {items.length - 6} more</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function RelationshipDetail({
  entity, contract, onEdit, onArchive, onRestore, onDelete, onOpenContract, onAskJova,
}: {
  entity: BusinessEntity; contract: Contract | null;
  onEdit: () => void; onArchive: () => void; onRestore: () => void; onDelete: () => void;
  onOpenContract: (id: string) => void; onAskJova: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_TONE[entity.status] ?? "neutral"}>{entity.status.replace("_", " ")}</StatusPill>
        <StatusPill tone={entity.risk_level === "high" ? "danger" : entity.risk_level === "medium" ? "warning" : "info"}>
          {entity.risk_level} risk
        </StatusPill>
        <StatusPill tone="neutral">{TYPE_LABEL[entity.entity_type]}</StatusPill>
      </div>
      <p className="text-[14px] text-foreground">{entity.relationship}</p>
      <div className="grid grid-cols-2 gap-3">
        <InfoRow label="Contact" value={entity.contact_name || "-"} />
        <InfoRow label="Email" value={entity.email || "-"} />
        <InfoRow label="Start date" value={entity.start_date ? formatDate(entity.start_date) : "-"} />
        <InfoRow label="Next review" value={entity.review_date ? <DateStatusBadge iso={entity.review_date} label="review" /> : "-"} />
        <InfoRow label="Importance" value={<span className="capitalize">{entity.importance}</span>} />
      </div>
      {contract && (
        <Card className="flex items-center justify-between gap-3 border border-border bg-[oklch(0.98_0.003_260)] p-3 shadow-none">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Linked contract</p>
            <p className="text-[13px] font-medium">{contract.title}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpenContract(contract.id)}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
          </Button>
        </Card>
      )}
      {entity.notes && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="mt-1 text-[13px] text-foreground">{entity.notes}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
        {entity.status === "archived" ? (
          <Button size="sm" variant="outline" onClick={onRestore}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onArchive}><Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>
        )}
        <Button size="sm" variant="ghost" onClick={onAskJova}><MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask Jova</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}

function EntityForm({ initial, onCancel, onSave }: { initial?: BusinessEntity; onCancel: () => void; onSave: (e: BusinessEntity) => void }) {
  const [e, setE] = useState<BusinessEntity>(initial ?? newEntityDraft("", "customer"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const errs: Record<string, string> = {};
    if (!e.name.trim()) errs.name = "Name is required.";
    if (!e.relationship.trim()) errs.relationship = "Describe the relationship.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(e);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit relationship" : "Add relationship"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name" required error={errors.name}>
            <Input value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={e.entity_type} onValueChange={(v) => setE({ ...e, entity_type: v as EntityType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as EntityType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={e.status} onValueChange={(v) => setE({ ...e, status: v as BusinessEntity["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="review_due">Review due</SelectItem>
                  <SelectItem value="at_risk">At risk</SelectItem>
                  <SelectItem value="missing_info">Missing info</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Relationship" required error={errors.relationship}>
            <Input value={e.relationship} onChange={(ev) => setE({ ...e, relationship: ev.target.value })} placeholder="e.g. Retained customer" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name"><Input value={e.contact_name} onChange={(ev) => setE({ ...e, contact_name: ev.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={e.email} onChange={(ev) => setE({ ...e, email: ev.target.value })} /></Field>
            <Field label="Importance">
              <Select value={e.importance} onValueChange={(v) => setE({ ...e, importance: v as BusinessEntity["importance"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Risk">
              <Select value={e.risk_level} onValueChange={(v) => setE({ ...e, risk_level: v as BusinessEntity["risk_level"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Start date"><Input type="date" value={e.start_date?.slice(0, 10) ?? ""} onChange={(ev) => setE({ ...e, start_date: ev.target.value || null })} /></Field>
            <Field label="Next review"><Input type="date" value={e.review_date?.slice(0, 10) ?? ""} onChange={(ev) => setE({ ...e, review_date: ev.target.value || null })} /></Field>
          </div>
          <Field label="Notes"><Textarea value={e.notes} onChange={(ev) => setE({ ...e, notes: ev.target.value })} rows={3} /></Field>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={save}>Save relationship</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useCoreData((s) => s.business_profile);
  const [p, setP] = useState(profile);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit business profile</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Business name"><Input value={p.business_name} onChange={(e) => setP({ ...p, business_name: e.target.value })} /></Field>
          <Field label="Company number"><Input value={p.company_number} onChange={(e) => setP({ ...p, company_number: e.target.value })} /></Field>
          <Field label="Business type"><Input value={p.business_type} onChange={(e) => setP({ ...p, business_type: e.target.value })} /></Field>
          <Field label="Industry"><Input value={p.industry} onChange={(e) => setP({ ...p, industry: e.target.value })} /></Field>
          <Field label="Registered address"><Input value={p.registered_address} onChange={(e) => setP({ ...p, registered_address: e.target.value })} /></Field>
          <Field label="Trading address"><Input value={p.trading_address} onChange={(e) => setP({ ...p, trading_address: e.target.value })} /></Field>
          <Field label="Financial year end"><Input value={p.financial_year_end} onChange={(e) => setP({ ...p, financial_year_end: e.target.value })} /></Field>
          <Field label="Revenue band">
            <Select value={p.annual_revenue_band} onValueChange={(v) => setP({ ...p, annual_revenue_band: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="< £100k">&lt; £100k</SelectItem>
                <SelectItem value="£100k – £500k">£100k – £500k</SelectItem>
                <SelectItem value="£500k – £1m">£500k – £1m</SelectItem>
                <SelectItem value="£1m – £5m">£1m – £5m</SelectItem>
                <SelectItem value="> £5m">&gt; £5m</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employees"><Input type="number" value={p.employee_count} onChange={(e) => setP({ ...p, employee_count: Number(e.target.value) || 0 })} /></Field>
          <Field label="Contractors"><Input type="number" value={p.contractor_count} onChange={(e) => setP({ ...p, contractor_count: Number(e.target.value) || 0 })} /></Field>
          <Field label="Customers"><Input type="number" value={p.customer_count} onChange={(e) => setP({ ...p, customer_count: Number(e.target.value) || 0 })} /></Field>
          <Field label="Suppliers"><Input type="number" value={p.supplier_count} onChange={(e) => setP({ ...p, supplier_count: Number(e.target.value) || 0 })} /></Field>
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={p.vat_registered} onCheckedChange={(v) => setP({ ...p, vat_registered: !!v })} /> VAT registered</label>
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={p.employer_registered} onCheckedChange={(v) => setP({ ...p, employer_registered: !!v })} /> Employer registered</label>
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={p.processes_personal_data} onCheckedChange={(v) => setP({ ...p, processes_personal_data: !!v })} /> Processes personal data</label>
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={p.trades_internationally} onCheckedChange={(v) => setP({ ...p, trades_internationally: !!v })} /> Trades internationally</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { updateBusinessProfile(p); toast.success("Business profile updated"); onClose(); }}>Save profile</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}