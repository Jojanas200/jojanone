"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import { contractIssues } from "./issues";
import { Pager } from "../_shared/board-bits";
import { printDocument, type PrintBlock } from "../_shared/print";
import type { EntityOption } from "./NewContract";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { listContracts } from "@/server/services/contracts";

type Contract = Awaited<ReturnType<typeof listContracts>>[number];

const TYPES = [
  "customer",
  "supplier",
  "employment",
  "contractor",
  "software",
  "office",
  "dpa",
  "insurance",
  "nda",
  "other",
];
const STATUSES = [
  "active",
  "draft",
  "expired",
  "archived",
  "pending_signature",
];
const RISKS = ["low", "medium", "high"];

const riskVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};
const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  active: "success",
  draft: "outline",
  expired: "destructive",
  archived: "outline",
  pending_signature: "warning",
};

const money = (minor: number, currency: string) =>
  minor
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
        minor / 100,
      )
    : "-";
const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
const nice = (s: string) => s.replace(/_/g, " ");
const within30 = (d: string | null) => {
  if (!d) return false;
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 30;
};

export function ContractsBoard({
  contracts,
  canWrite,
  entities = [],
}: {
  contracts: Contract[];
  canWrite: boolean;
  entities?: EntityOption[];
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [riskF, setRiskF] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [active, setActive] = useState<Contract | null>(null);

  const stats = useMemo(() => {
    const total = contracts.length;
    const activeCount = contracts.filter((c) => c.status === "active").length;
    const drafts = contracts.filter((c) => c.status === "draft").length;
    const expiring = contracts.filter(
      (c) => c.status === "active" && within30(c.endDate),
    ).length;
    const highRisk = contracts.filter((c) => c.riskLevel === "high").length;
    const value = contracts.reduce((s, c) => s + (c.valueMinor ?? 0), 0);
    return { total, activeCount, drafts, expiring, highRisk, value };
  }, [contracts]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (typeF !== "all" && c.contractType !== typeF) return false;
      if (statusF !== "all" && c.status !== statusF) return false;
      if (riskF !== "all" && c.riskLevel !== riskF) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !(c.counterparty ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [contracts, search, typeF, statusF, riskF]);

  const filtersActive =
    !!search || typeF !== "all" || statusF !== "all" || riskF !== "all";

  const tiles = [
    { label: "Contracts", value: String(stats.total) },
    { label: "Active", value: String(stats.activeCount) },
    { label: "Drafts", value: String(stats.drafts) },
    { label: "Expiring 30d", value: String(stats.expiring) },
    { label: "High risk", value: String(stats.highRisk) },
    { label: "Recorded value", value: money(stats.value, "GBP") },
  ];

  // Client-side pagination keeps the register readable as records grow.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const paged = shown.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xl font-semibold text-foreground">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or counterparty…"
            className="pl-9"
            aria-label="Search contracts"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <FilterSelect
            value={typeF}
            onChange={setTypeF}
            allLabel="All types"
            options={TYPES}
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
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
            >
              <TableProperties className="mr-1 h-3.5 w-3.5" />
              Table
            </Button>
            <Button
              variant={view === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid className="mr-1 h-3.5 w-3.5" />
              Cards
            </Button>
          </div>
        </div>
      </div>

      {contracts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No contracts yet. Add your first one to start tracking renewals and
          risk.
        </Card>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No contracts match your filters.
        </Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => {
                  const issues = contractIssues(c);
                  return (
                    <TableRow
                      key={c.id}
                      onClick={() => setActive(c)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {issues.length > 0 && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-destructive"
                              aria-label={issues[0]}
                            />
                          )}
                          {c.title}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.counterparty || "-"}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {c.contractType}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[c.status] ?? "outline"}>
                          {nice(c.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {money(c.valueMinor, c.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(c.nextActionDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(c.endDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={riskVariant[c.riskLevel] ?? "outline"}>
                          {c.riskLevel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((c) => {
            const issues = contractIssues(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c)}
                className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-foreground/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{c.title}</p>
                  <Badge variant={statusVariant[c.status] ?? "outline"}>
                    {nice(c.status)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {c.counterparty || "No counterparty"} · {c.contractType}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{money(c.valueMinor, c.currency)}</span>
                  <span>Ends {fmtDate(c.endDate)}</span>
                  <Badge variant={riskVariant[c.riskLevel] ?? "outline"}>
                    {c.riskLevel}
                  </Badge>
                </div>
                {issues.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {issues[0]}
                    {issues.length > 1 && ` (+${issues.length - 1} more)`}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Pager
        page={cur}
        pageCount={pageCount}
        total={shown.length}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <ContractDrawer
        contract={active}
        canWrite={canWrite}
        entities={entities}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-36 text-xs capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {nice(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContractDrawer({
  contract,
  canWrite,
  entities,
  onClose,
}: {
  contract: Contract | null;
  canWrite: boolean;
  entities: EntityOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Close resets edit state.
  const close = () => {
    setEditing(false);
    onClose();
  };

  return (
    <Sheet open={!!contract} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {contract &&
          (editing ? (
            <ContractEditForm
              contract={contract}
              entities={entities}
              saving={saving}
              setSaving={setSaving}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ContractView
              contract={contract}
              canWrite={canWrite}
              entities={entities}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function ContractView({
  contract: c,
  canWrite,
  entities,
  onEdit,
  onChanged,
  onClosed,
}: {
  contract: Contract;
  canWrite: boolean;
  entities: EntityOption[];
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const issues = contractIssues(c);
  const linkedEntity = c.entityId
    ? entities.find((en) => en.id === c.entityId)
    : undefined;

  function printContract() {
    const blocks: PrintBlock[] = [
      {
        kind: "rows",
        rows: [
          ["Counterparty", c.counterparty || "-"],
          ["Type", c.contractType],
          ["Status", nice(c.status)],
          ["Value", money(c.valueMinor, c.currency)],
          ["Risk level", c.riskLevel],
          ["Owner", c.owner || "-"],
          ["Starts", fmtDate(c.startDate)],
          ["Ends", fmtDate(c.endDate)],
          ["Renewal", fmtDate(c.renewalDate)],
          [
            "Notice period",
            c.noticePeriodDays != null ? `${c.noticePeriodDays} days` : "-",
          ],
          [
            "Next action",
            c.nextAction
              ? `${c.nextAction} (${fmtDate(c.nextActionDate)})`
              : "-",
          ],
          ["Linked relationship", linkedEntity?.name ?? "-"],
        ],
      },
    ];
    if (issues.length > 0)
      blocks.push({ kind: "list", heading: "Needs attention", items: issues });
    if (c.keyTerms)
      blocks.push({ kind: "text", heading: "Key terms", body: c.keyTerms });
    if (c.obligations)
      blocks.push({
        kind: "text",
        heading: "Obligations",
        body: c.obligations,
      });
    if (c.notes) blocks.push({ kind: "text", heading: "Notes", body: c.notes });
    printDocument({
      title: c.title,
      meta: `Contract summary · ${c.contractType} · ${nice(c.status)}`,
      blocks,
      disclaimer:
        "A summary of your own records, not the contract itself or legal advice.",
    });
  }

  async function completeNextAction() {
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextAction: null, nextActionDate: null }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Next action completed");
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType: c.contractType,
          title: `${c.title} (copy)`,
          counterparty: c.counterparty ?? "",
          status: "draft",
          currency: c.currency,
          valueMinor: c.valueMinor,
          riskLevel: c.riskLevel,
          startDate: c.startDate,
          endDate: c.endDate,
          renewalDate: c.renewalDate,
          noticePeriodDays: c.noticePeriodDays,
          owner: c.owner,
          keyTerms: c.keyTerms,
          obligations: c.obligations,
          nextAction: c.nextAction,
          nextActionDate: c.nextActionDate,
          notes: c.notes,
          entityId: c.entityId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Contract duplicated");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Contract deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Status updated");
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{c.title}</SheetTitle>
        <SheetDescription className="capitalize">
          {c.contractType} · {nice(c.status)}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printContract}>
          Print
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        {issues.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs attention
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-foreground">
              {issues.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          </div>
        )}
        <dl className="space-y-3">
          <Field label="Counterparty">{c.counterparty || "-"}</Field>
          <Field label="Value">{money(c.valueMinor, c.currency)}</Field>
          <Field label="Risk level">
            <Badge variant={riskVariant[c.riskLevel] ?? "outline"}>
              {c.riskLevel}
            </Badge>
          </Field>
          <Field label="Owner">{c.owner || "-"}</Field>
          <Field label="Starts">{fmtDate(c.startDate)}</Field>
          <Field label="Ends">{fmtDate(c.endDate)}</Field>
          <Field label="Renewal">{fmtDate(c.renewalDate)}</Field>
          <Field label="Notice period">
            {c.noticePeriodDays != null ? `${c.noticePeriodDays} days` : "-"}
          </Field>
          <Field label="Next action">
            {c.nextAction ? (
              <span className="inline-flex items-center gap-2">
                {c.nextAction} ({fmtDate(c.nextActionDate)})
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={completeNextAction}
                    disabled={busy}
                  >
                    Complete
                  </Button>
                )}
              </span>
            ) : (
              "-"
            )}
          </Field>
          <Field label="Linked relationship">
            {c.entityId ? (
              <Link
                href="/business-map"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                {linkedEntity?.name ?? "Open Business Map"}
              </Link>
            ) : (
              "-"
            )}
          </Field>
        </dl>
        {c.keyTerms && <Block label="Key terms" body={c.keyTerms} />}
        {c.obligations && <Block label="Obligations" body={c.obligations} />}
        {c.notes && <Block label="Notes" body={c.notes} />}

        {canWrite && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={duplicate}
                disabled={busy}
              >
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={remove}
                disabled={busy}
              >
                Delete
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Set status:</span>
              {STATUSES.filter((s) => s !== c.status).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="ghost"
                  className="h-7 capitalize"
                  onClick={() => setStatus(s)}
                  disabled={busy}
                >
                  {nice(s)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ContractEditForm({
  contract: c,
  entities,
  saving,
  setSaving,
  onDone,
  onCancel,
}: {
  contract: Contract;
  entities: EntityOption[];
  saving: boolean;
  setSaving: (v: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    title: c.title,
    counterparty: c.counterparty ?? "",
    contractType: c.contractType,
    status: c.status,
    riskLevel: c.riskLevel,
    currency: c.currency,
    value: c.valueMinor ? String(c.valueMinor / 100) : "",
    startDate: c.startDate ?? "",
    endDate: c.endDate ?? "",
    renewalDate: c.renewalDate ?? "",
    noticePeriodDays:
      c.noticePeriodDays != null ? String(c.noticePeriodDays) : "",
    owner: c.owner ?? "",
    entityId: c.entityId ?? "none",
    keyTerms: c.keyTerms ?? "",
    obligations: c.obligations ?? "",
    nextAction: c.nextAction ?? "",
    nextActionDate: c.nextActionDate ?? "",
    notes: c.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title,
        counterparty: f.counterparty,
        contractType: f.contractType,
        status: f.status,
        riskLevel: f.riskLevel,
        currency: f.currency || "GBP",
        valueMinor: f.value ? Math.round(parseFloat(f.value) * 100) : 0,
        noticePeriodDays: f.noticePeriodDays
          ? parseInt(f.noticePeriodDays, 10)
          : null,
        startDate: f.startDate || null,
        endDate: f.endDate || null,
        renewalDate: f.renewalDate || null,
        nextActionDate: f.nextActionDate || null,
        owner: f.owner || null,
        entityId: f.entityId === "none" ? null : f.entityId,
        keyTerms: f.keyTerms || null,
        obligations: f.obligations || null,
        nextAction: f.nextAction || null,
        notes: f.notes || null,
      };
      const res = await fetch(`/api/contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Contract saved");
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
        <SheetTitle>Edit contract</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={set("title")}
          required
        />
        <TextField
          label="Counterparty"
          value={f.counterparty}
          onChange={set("counterparty")}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Type"
            value={f.contractType}
            onChange={set("contractType")}
            options={TYPES}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Risk"
            value={f.riskLevel}
            onChange={set("riskLevel")}
            options={RISKS}
          />
          <TextField
            label="Value"
            type="number"
            value={f.value}
            onChange={set("value")}
          />
        </div>
        <SelectField
          label="Currency"
          value={f.currency}
          onChange={set("currency")}
          options={["GBP", "EUR", "USD"]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Starts"
            type="date"
            value={f.startDate}
            onChange={set("startDate")}
          />
          <TextField
            label="Ends"
            type="date"
            value={f.endDate}
            onChange={set("endDate")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Renewal"
            type="date"
            value={f.renewalDate}
            onChange={set("renewalDate")}
          />
          <TextField
            label="Notice (days)"
            type="number"
            value={f.noticePeriodDays}
            onChange={set("noticePeriodDays")}
          />
        </div>
        <TextField label="Owner" value={f.owner} onChange={set("owner")} />
        {entities.length > 0 && (
          <div className="space-y-1.5">
            <Label>Linked relationship</Label>
            <Select value={f.entityId} onValueChange={set("entityId")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {entities.map((en) => (
                  <SelectItem key={en.id} value={en.id}>
                    {en.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Next action"
            value={f.nextAction}
            onChange={set("nextAction")}
          />
          <TextField
            label="Next action date"
            type="date"
            value={f.nextActionDate}
            onChange={set("nextActionDate")}
          />
        </div>
        <AreaField
          label="Key terms"
          value={f.keyTerms}
          onChange={set("keyTerms")}
        />
        <AreaField
          label="Obligations"
          value={f.obligations}
          onChange={set("obligations")}
        />
        <AreaField label="Notes" value={f.notes} onChange={set("notes")} />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{body}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {nice(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
