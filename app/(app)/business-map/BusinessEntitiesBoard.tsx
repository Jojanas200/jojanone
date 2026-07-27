"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Handshake,
  Landmark,
  Plus,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaField,
  Field,
  FilterIcon,
  FilterSelect,
  SearchInput,
  SelectField,
  StatTiles,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import type { listEntities } from "@/server/services/business-entities";

type Entity = Awaited<ReturnType<typeof listEntities>>[number];

const TYPE_LABEL: Record<string, string> = {
  customer: "Customer",
  supplier: "Supplier",
  director: "Director",
  employee: "Employee",
  contractor: "Contractor",
  tech_lead: "Technology lead",
  adviser: "Adviser",
  regulator: "Regulator",
  partner: "Business partner",
  insurer: "Insurer",
  bank: "Bank / finance",
};
const TYPES = Object.keys(TYPE_LABEL);
const STATUSES = [
  "active",
  "review_due",
  "at_risk",
  "archived",
  "missing_info",
];
const IMPORTANCE = ["high", "medium", "low", "none"];
const RISKS = ["low", "medium", "high"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  active: "success",
  review_due: "warning",
  at_risk: "destructive",
  archived: "outline",
  missing_info: "destructive",
};
const riskVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

// Relationship-map groups (central business at the centre).
const MAP_GROUPS: {
  key: string;
  label: string;
  icon: typeof Handshake;
  types: string[];
}[] = [
  {
    key: "customers",
    label: "Customers",
    icon: Handshake,
    types: ["customer"],
  },
  { key: "suppliers", label: "Suppliers", icon: Truck, types: ["supplier"] },
  {
    key: "people",
    label: "Team & Key People",
    icon: Users,
    types: ["director", "employee", "contractor", "tech_lead"],
  },
  {
    key: "advisers",
    label: "Advisers & partners",
    icon: Building2,
    types: ["adviser", "partner"],
  },
  {
    key: "regulators",
    label: "Regulators",
    icon: Landmark,
    types: ["regulator"],
  },
  {
    key: "finance",
    label: "Finance & insurance",
    icon: Wallet,
    types: ["bank", "insurer"],
  },
];

// Light projection of contracts linked to entities (via contracts.entityId).
export type LinkedContract = {
  id: string;
  title: string;
  entityId: string | null;
  status: string;
};

export function BusinessEntitiesBoard({
  entities,
  businessName,
  canWrite,
  contracts = [],
}: {
  entities: Entity[];
  businessName: string;
  canWrite: boolean;
  contracts?: LinkedContract[];
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [riskF, setRiskF] = useState("all");
  const [active, setActive] = useState<Entity | "new" | null>(null);

  const insights = useMemo(() => {
    const live = entities.filter((e) => e.status !== "archived");
    return [
      { label: "Key parties", value: String(live.length) },
      {
        label: "Reviews due",
        value: String(live.filter((e) => e.status === "review_due").length),
      },
      {
        label: "At risk",
        value: String(live.filter((e) => e.status === "at_risk").length),
      },
      {
        label: "Supplier dependency",
        value: String(
          live.filter(
            (e) => e.entityType === "supplier" && e.importance === "high",
          ).length,
        ),
      },
    ];
  }, [entities]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entities.filter((e) => {
      if (typeF !== "all" && e.entityType !== typeF) return false;
      if (statusF !== "all" && e.status !== statusF) return false;
      if (riskF !== "all" && e.riskLevel !== riskF) return false;
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !(e.relationship ?? "").toLowerCase().includes(q) &&
        !(e.contactName ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [entities, search, typeF, statusF, riskF]);

  const filtersActive =
    !!search || typeF !== "all" || statusF !== "all" || riskF !== "all";

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Key parties</h2>
          <p className="text-sm text-muted-foreground">
            The people and organisations your business depends on.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add relationship
          </Button>
        )}
      </div>

      <StatTiles tiles={insights} />

      <Tabs defaultValue="map">
        <TabsList>
          <TabsTrigger value="map">Relationship map</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        {/* Relationship map */}
        <TabsContent value="map" className="mt-4">
          <RelationshipMap
            entities={entities}
            businessName={businessName}
            onOpen={(e) => setActive(e)}
          />
        </TabsContent>

        {/* Category view */}
        <TabsContent value="category" className="mt-4 space-y-6">
          {entities.filter((e) => e.status !== "archived").length === 0 ? (
            <EmptyState />
          ) : (
            TYPES.map((t) => {
              const items = entities.filter(
                (e) => e.entityType === t && e.status !== "archived",
              );
              if (!items.length) return null;
              return (
                <div key={t}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[t]}s ({items.length})
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((e) => (
                      <EntityCard
                        key={e.id}
                        entity={e}
                        onClick={() => setActive(e)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* List view */}
        <TabsContent value="list" className="mt-4">
          <div className="mb-4 space-y-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, relationship or contact…"
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilterIcon />
              <FilterSelect
                value={typeF}
                onChange={setTypeF}
                allLabel="All types"
                options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              />
              <FilterSelect
                value={statusF}
                onChange={setStatusF}
                allLabel="Any status"
                options={STATUSES}
              />
              <FilterSelect
                value={riskF}
                onChange={setRiskF}
                allLabel="Any risk"
                options={RISKS}
              />
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTypeF("all");
                    setStatusF("all");
                    setRiskF("all");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            {entities.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No key parties recorded yet. Add the customers, suppliers,
                advisers and regulators your business relies on.
              </div>
            ) : shown.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No parties match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Importance</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((e) => (
                      <TableRow
                        key={e.id}
                        onClick={() => setActive(e)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium text-foreground">
                          {e.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {TYPE_LABEL[e.entityType] ?? e.entityType}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.relationship || "-"}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {e.importance}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={riskVariant[e.riskLevel] ?? "outline"}
                          >
                            {e.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[e.status] ?? "outline"}>
                            {nice(e.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <EntityDrawer
        item={active}
        canWrite={canWrite}
        contracts={contracts}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function EmptyState() {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground">
      No key parties recorded yet. Add the customers, suppliers, advisers and
      regulators your business relies on.
    </Card>
  );
}

function RelationshipMap({
  entities,
  businessName,
  onOpen,
}: {
  entities: Entity[];
  businessName: string;
  onOpen: (e: Entity) => void;
}) {
  return (
    <Card className="p-6">
      <div className="mx-auto max-w-3xl">
        <div className="grid place-items-center rounded-lg border border-primary bg-primary/5 p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Central business
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {businessName || "Your business"}
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MAP_GROUPS.map((g) => {
            const items = entities.filter(
              (e) => g.types.includes(e.entityType) && e.status !== "archived",
            );
            const Icon = g.icon;
            return (
              <Card key={g.key} className="p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {g.label}
                  </p>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    None recorded.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {items.slice(0, 6).map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(e)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              e.riskLevel === "high"
                                ? "bg-red-500"
                                : e.status === "review_due"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                          />
                          <span className="truncate text-foreground">
                            {e.name}
                          </span>
                        </button>
                      </li>
                    ))}
                    {items.length > 6 && (
                      <li className="px-2 py-1 text-xs text-muted-foreground">
                        + {items.length - 6} more
                      </li>
                    )}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function EntityCard({
  entity: e,
  onClick,
}: {
  entity: Entity;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {e.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {e.relationship || TYPE_LABEL[e.entityType]}
          </p>
        </div>
        <Badge variant={statusVariant[e.status] ?? "outline"}>
          {nice(e.status)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {e.importance === "high" && <Badge variant="outline">Important</Badge>}
        {e.riskLevel === "high" && (
          <Badge variant="destructive">High risk</Badge>
        )}
        {e.reviewDate && (
          <span className="text-[11px] text-muted-foreground">
            review {fmtDate(e.reviewDate)}
          </span>
        )}
      </div>
    </button>
  );
}

function EntityDrawer({
  item,
  canWrite,
  contracts,
  onClose,
}: {
  item: Entity | "new" | null;
  canWrite: boolean;
  contracts: LinkedContract[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const creating = item === "new";
  const close = () => {
    setEditing(false);
    onClose();
  };
  return (
    <Sheet open={!!item} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {item &&
          (creating || editing ? (
            <EntityForm
              entity={creating ? null : (item as Entity)}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <EntityView
              entity={item as Entity}
              canWrite={canWrite}
              contracts={contracts}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function EntityView({
  entity: e,
  canWrite,
  contracts,
  onEdit,
  onChanged,
  onClosed,
}: {
  entity: Entity;
  canWrite: boolean;
  contracts: LinkedContract[];
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const linked = contracts.filter((c) => c.entityId === e.id);

  async function setStatus(status: string, message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/business-entities/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(message);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${e.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/business-entities/${e.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Party removed");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{e.name}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant[e.status] ?? "outline"}>
            {nice(e.status)}
          </Badge>
          <Badge variant={riskVariant[e.riskLevel] ?? "outline"}>
            {e.riskLevel} risk
          </Badge>
          <Badge variant="outline">{TYPE_LABEL[e.entityType]}</Badge>
        </div>
        <dl className="space-y-3">
          <Field label="Relationship">{e.relationship || "-"}</Field>
          <Field label="Importance">
            <span className="capitalize">{e.importance}</span>
          </Field>
          <Field label="Contact">{e.contactName || "-"}</Field>
          <Field label="Email">{e.email || "-"}</Field>
          <Field label="Since">{fmtDate(e.startDate)}</Field>
          <Field label="Next review">{fmtDate(e.reviewDate)}</Field>
        </dl>
        {e.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {e.notes}
            </p>
          </div>
        )}

        {linked.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Linked contracts
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {linked.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-2.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {c.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {nice(c.status)}
                    </Badge>
                    <Link
                      href="/contracts"
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href={`/jova?q=${encodeURIComponent(`Tell me about our relationship with ${e.name} and anything that needs attention.`)}`}
            className="text-muted-foreground hover:text-foreground"
          >
            Ask Jova
          </Link>
        </div>

        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            {e.status === "archived" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("active", "Relationship restored")}
                disabled={busy}
              >
                Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("archived", "Relationship archived")}
                disabled={busy}
              >
                Archive
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={remove}
              disabled={busy}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function EntityForm({
  entity: e,
  onDone,
  onCancel,
}: {
  entity: Entity | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    entityType: e?.entityType ?? "customer",
    name: e?.name ?? "",
    relationship: e?.relationship ?? "",
    status: e?.status ?? "active",
    importance: e?.importance ?? "medium",
    riskLevel: e?.riskLevel ?? "low",
    contactName: e?.contactName ?? "",
    email: e?.email ?? "",
    startDate: e?.startDate ?? "",
    reviewDate: e?.reviewDate ?? "",
    notes: e?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        entityType: f.entityType,
        name: f.name,
        relationship: f.relationship || null,
        status: f.status,
        importance: f.importance,
        riskLevel: f.riskLevel,
        contactName: f.contactName || null,
        email: f.email || null,
        startDate: f.startDate || null,
        reviewDate: f.reviewDate || null,
        notes: f.notes || null,
      };
      const res = await fetch(
        e ? `/api/business-entities/${e.id}` : "/api/business-entities",
        {
          method: e ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(e ? "Party saved" : "Relationship added");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <SheetHeader>
        <SheetTitle>{e ? "Edit relationship" : "Add relationship"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Name"
          value={f.name}
          onChange={set("name")}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Type"
            value={f.entityType}
            onChange={set("entityType")}
            options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
        </div>
        <TextField
          label="Relationship"
          value={f.relationship}
          onChange={set("relationship")}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Importance"
            value={f.importance}
            onChange={set("importance")}
            options={IMPORTANCE}
          />
          <SelectField
            label="Risk"
            value={f.riskLevel}
            onChange={set("riskLevel")}
            options={RISKS}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Contact name"
            value={f.contactName}
            onChange={set("contactName")}
          />
          <TextField label="Email" value={f.email} onChange={set("email")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Since"
            type="date"
            value={f.startDate}
            onChange={set("startDate")}
          />
          <TextField
            label="Next review"
            type="date"
            value={f.reviewDate}
            onChange={set("reviewDate")}
          />
        </div>
        <AreaField label="Notes" value={f.notes} onChange={set("notes")} />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : e ? "Save changes" : "Add relationship"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
