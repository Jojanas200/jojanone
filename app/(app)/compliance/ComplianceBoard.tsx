"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AreaField,
  Block,
  Field,
  FilterIcon,
  FilterSelect,
  SearchInput,
  SelectField,
  StatTiles,
  SwitchField,
  TextField,
  Pager,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import { ConfirmEvidence } from "./ConfirmEvidence";
import type { listObligations } from "@/server/services/compliance";

type Obligation = Awaited<ReturnType<typeof listObligations>>[number];
type EvidenceItem = {
  id: string;
  title: string;
  category: string;
  notes: string | null;
  fileName: string | null;
  reviewDate: string | null;
  status: string;
  createdAt: string;
};

const CATEGORIES = [
  "companies_house",
  "tax",
  "vat",
  "payroll",
  "pensions",
  "insurance",
  "employment",
  "data_protection",
  "health_safety",
  "insurance_business",
  "governance",
  "other",
];
const STATUSES = [
  "action_required",
  "in_progress",
  "completed",
  "overdue",
  "upcoming",
  "not_applicable",
];
const PRIORITIES = ["high", "medium", "low"];
const RECURRENCES = ["none", "annual", "quarterly", "monthly", "weekly"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  action_required: "warning",
  overdue: "destructive",
  in_progress: "warning",
  completed: "success",
  upcoming: "outline",
  not_applicable: "outline",
};
const priorityVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = { high: "destructive", medium: "warning", low: "success" };
const evidenceLabel: Record<string, string> = {
  not_started: "None",
  in_progress: "Partial",
  complete: "Complete",
};

const isOverdue = (d: string | null, status: string) =>
  !!d &&
  new Date(d).getTime() < Date.now() &&
  status !== "completed" &&
  status !== "not_applicable";
const within30 = (d: string | null) => {
  if (!d) return false;
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 30;
};

export function ComplianceBoard({
  obligations,
  canWrite,
}: {
  obligations: Obligation[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [categoryF, setCategoryF] = useState("all");
  const [regulatorF, setRegulatorF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Obligation | null>(null);

  // Regulators actually present in the register (keeps the filter honest).
  const regulators = useMemo(
    () =>
      Array.from(
        new Set(
          obligations
            .map((o) => o.regulator?.trim())
            .filter((r): r is string => !!r),
        ),
      ).sort(),
    [obligations],
  );

  const tiles = useMemo(() => {
    const applicable = obligations.filter(
      (o) => o.applicabilityStatus === "applicable",
    ).length;
    const actionReq = obligations.filter(
      (o) => o.status === "action_required",
    ).length;
    const overdue = obligations.filter(
      (o) => o.status === "overdue" || isOverdue(o.dueDate, o.status),
    ).length;
    const due30 = obligations.filter(
      (o) =>
        within30(o.dueDate) &&
        o.status !== "completed" &&
        o.status !== "not_applicable",
    ).length;
    const awaiting = obligations.filter(
      (o) =>
        o.evidenceStatus !== "complete" &&
        o.status !== "completed" &&
        o.status !== "not_applicable",
    ).length;
    const completed = obligations.filter(
      (o) => o.status === "completed",
    ).length;
    return [
      { label: "Applicable", value: String(applicable) },
      { label: "Action required", value: String(actionReq) },
      { label: "Overdue", value: String(overdue) },
      { label: "Due 30d", value: String(due30) },
      { label: "Awaiting evidence", value: String(awaiting) },
      { label: "Completed", value: String(completed) },
    ];
  }, [obligations]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return obligations.filter((o) => {
      if (categoryF !== "all" && o.category !== categoryF) return false;
      if (regulatorF !== "all" && (o.regulator ?? "") !== regulatorF)
        return false;
      if (priorityF !== "all" && o.priority !== priorityF) return false;
      if (statusF !== "all" && o.status !== statusF) return false;
      if (
        q &&
        !o.title.toLowerCase().includes(q) &&
        !(o.regulator ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [obligations, search, categoryF, regulatorF, priorityF, statusF]);

  const filtersActive =
    !!search ||
    categoryF !== "all" ||
    regulatorF !== "all" ||
    priorityF !== "all" ||
    statusF !== "all";

  // Client-side pagination keeps the register readable as records grow.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const paged = shown.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by obligation or regulator…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon />
          <FilterSelect
            value={categoryF}
            onChange={setCategoryF}
            allLabel="All categories"
            options={CATEGORIES}
          />
          {regulators.length > 0 && (
            <FilterSelect
              value={regulatorF}
              onChange={setRegulatorF}
              allLabel="All regulators"
              options={regulators}
            />
          )}
          <FilterSelect
            value={priorityF}
            onChange={setPriorityF}
            allLabel="Any priority"
            options={PRIORITIES}
          />
          <FilterSelect
            value={statusF}
            onChange={setStatusF}
            allLabel="Any status"
            options={STATUSES}
          />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategoryF("all");
                setRegulatorF("all");
                setPriorityF("all");
                setStatusF("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {obligations.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No obligations yet. Add your statutory and regulatory obligations to
            start tracking deadlines and evidence.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No obligations match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Regulator</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((o) => (
                  <TableRow
                    key={o.id}
                    onClick={() => setActive(o)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {o.title}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {nice(o.category)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.regulator || "-"}
                    </TableCell>
                    <TableCell
                      className={
                        isOverdue(o.dueDate, o.status)
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {fmtDate(o.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[o.priority] ?? "outline"}>
                        {o.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {evidenceLabel[o.evidenceStatus] ?? o.evidenceStatus}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[o.status] ?? "outline"}>
                        {nice(o.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Pager
        page={cur}
        pageCount={pageCount}
        total={shown.length}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <ObligationDrawer
        obligation={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function ObligationDrawer({
  obligation,
  canWrite,
  onClose,
}: {
  obligation: Obligation | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const close = () => {
    setEditing(false);
    onClose();
  };

  return (
    <Sheet open={!!obligation} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {obligation &&
          (editing ? (
            <ObligationEditForm
              obligation={obligation}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ObligationView
              obligation={obligation}
              canWrite={canWrite}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function ObligationView({
  obligation: o,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  obligation: Obligation;
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/compliance/${o.id}/evidence`)
      .then((r) => (r.ok ? r.json() : { evidence: [] }))
      .then((d) => alive && setEvidence(d.evidence ?? []))
      .catch(() => alive && setEvidence([]));
    return () => {
      alive = false;
    };
  }, [o.id]);

  function printObligation() {
    const blocks: PrintBlock[] = [
      {
        kind: "rows",
        rows: [
          ["Category", nice(o.category)],
          ["Regulator", o.regulator || "-"],
          ["Status", nice(o.status)],
          ["Due", fmtDate(o.dueDate)],
          ["Priority", o.priority],
          ["Recurrence", nice(o.recurrence)],
          ["Owner", o.owner || "-"],
          ["Applicability", nice(o.applicabilityStatus)],
          [
            "Professional support",
            o.professionalSupportRequired ? "Recommended" : "Not required",
          ],
        ],
      },
    ];
    if (o.reasonApplies)
      blocks.push({
        kind: "text",
        heading: "Why it applies",
        body: o.reasonApplies,
      });
    if (o.plainLanguageExplanation)
      blocks.push({
        kind: "text",
        heading: "In plain English",
        body: o.plainLanguageExplanation,
      });
    if (o.requiredAction)
      blocks.push({
        kind: "text",
        heading: "Required action",
        body: o.requiredAction,
      });
    if (o.requiredEvidence.length > 0)
      blocks.push({
        kind: "list",
        heading: "Required evidence",
        items: o.requiredEvidence,
      });
    if (evidence && evidence.length > 0)
      blocks.push({
        kind: "list",
        heading: "Evidence recorded",
        items: evidence.map(
          (e) => `${e.title}${e.fileName ? ` (${e.fileName})` : ""}`,
        ),
      });
    printDocument({
      title: o.title,
      meta: `Compliance obligation · ${nice(o.category)}${o.regulator ? ` · ${o.regulator}` : ""}`,
      blocks,
      disclaimer: "Guidance, not legal advice.",
    });
  }

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/compliance/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(msg);
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${o.title}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/compliance/${o.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Obligation deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function markNotApplicable() {
    const reason = window.prompt("Why is this not applicable?") ?? "";
    void patch(
      {
        applicabilityStatus: "not_applicable",
        status: "not_applicable",
        naReason: reason || null,
      },
      "Marked not applicable",
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{o.title}</SheetTitle>
        <SheetDescription className="capitalize">
          {nice(o.category)}
          {o.regulator ? ` · ${o.regulator}` : ""} · {nice(o.status)}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printObligation}>
          Print
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Due">{fmtDate(o.dueDate)}</Field>
          <Field label="Priority">
            <span className="capitalize">{o.priority}</span>
          </Field>
          <Field label="Recurrence">
            <span className="capitalize">{nice(o.recurrence)}</span>
          </Field>
          <Field label="Owner">{o.owner || "-"}</Field>
          <Field label="Evidence">
            {evidenceLabel[o.evidenceStatus] ?? o.evidenceStatus}
          </Field>
          <Field label="Applicability">
            <span className="capitalize">{nice(o.applicabilityStatus)}</span>
          </Field>
          <Field label="Professional support">
            {o.professionalSupportRequired ? "Recommended" : "Not required"}
          </Field>
        </dl>

        {o.reasonApplies && (
          <Block label="Why it applies" body={o.reasonApplies} />
        )}
        {o.plainLanguageExplanation && (
          <Block label="In plain English" body={o.plainLanguageExplanation} />
        )}
        {o.requiredAction && (
          <Block label="Required action" body={o.requiredAction} />
        )}
        {o.naReason && (
          <Block label="Not-applicable reason" body={o.naReason} />
        )}
        {o.requiredEvidence.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Required evidence
            </p>
            <ul className="mt-1 list-inside list-disc text-foreground">
              {o.requiredEvidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Recorded evidence
          </p>
          {evidence === null ? (
            <p className="mt-1 text-muted-foreground">Loading…</p>
          ) : evidence.length === 0 ? (
            <p className="mt-1 text-muted-foreground">
              No evidence recorded yet.
            </p>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-border px-3 py-2"
                >
                  <p className="font-medium text-foreground">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {nice(e.category)} · {fmtDate(e.createdAt)}
                    {e.fileName ? ` · ${e.fileName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canWrite && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
              {o.status !== "completed" && o.status !== "not_applicable" && (
                <ConfirmEvidence
                  obligationId={o.id}
                  obligationTitle={o.title}
                />
              )}
              {o.status === "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({ status: "in_progress" }, "Obligation reopened")
                  }
                  disabled={busy}
                >
                  Reopen
                </Button>
              )}
              {o.status !== "not_applicable" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markNotApplicable}
                  disabled={busy}
                >
                  Mark N/A
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={remove}
                disabled={busy}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ObligationEditForm({
  obligation: o,
  onDone,
  onCancel,
}: {
  obligation: Obligation;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: o.title,
    category: o.category,
    regulator: o.regulator ?? "",
    jurisdiction: o.jurisdiction ?? "",
    priority: o.priority,
    status: o.status,
    dueDate: o.dueDate ?? "",
    recurrence: o.recurrence,
    owner: o.owner ?? "",
    requiredAction: o.requiredAction ?? "",
    reasonApplies: o.reasonApplies ?? "",
    plainLanguageExplanation: o.plainLanguageExplanation ?? "",
    professionalSupportRequired: o.professionalSupportRequired,
    notes: o.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          category: f.category,
          regulator: f.regulator || null,
          jurisdiction: f.jurisdiction || null,
          priority: f.priority,
          status: f.status,
          dueDate: f.dueDate || null,
          recurrence: f.recurrence,
          owner: f.owner || null,
          requiredAction: f.requiredAction || null,
          reasonApplies: f.reasonApplies || null,
          plainLanguageExplanation: f.plainLanguageExplanation || null,
          professionalSupportRequired: f.professionalSupportRequired,
          notes: f.notes || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Obligation saved");
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
        <SheetTitle>Edit obligation</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={(v) => set("title")(v)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            value={f.category}
            onChange={(v) => set("category")(v)}
            options={CATEGORIES}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={(v) => set("status")(v)}
            options={STATUSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Priority"
            value={f.priority}
            onChange={(v) => set("priority")(v)}
            options={PRIORITIES}
          />
          <SelectField
            label="Recurrence"
            value={f.recurrence}
            onChange={(v) => set("recurrence")(v)}
            options={RECURRENCES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Regulator"
            value={f.regulator}
            onChange={(v) => set("regulator")(v)}
          />
          <TextField
            label="Due date"
            type="date"
            value={f.dueDate}
            onChange={(v) => set("dueDate")(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Jurisdiction"
            value={f.jurisdiction}
            onChange={(v) => set("jurisdiction")(v)}
          />
          <TextField
            label="Owner"
            value={f.owner}
            onChange={(v) => set("owner")(v)}
          />
        </div>
        <AreaField
          label="Required action"
          value={f.requiredAction}
          onChange={(v) => set("requiredAction")(v)}
        />
        <AreaField
          label="Why it applies"
          value={f.reasonApplies}
          onChange={(v) => set("reasonApplies")(v)}
        />
        <AreaField
          label="In plain English"
          value={f.plainLanguageExplanation}
          onChange={(v) => set("plainLanguageExplanation")(v)}
        />
        <SwitchField
          label="Professional support recommended"
          checked={f.professionalSupportRequired}
          onChange={(v) => set("professionalSupportRequired")(v)}
        />
        <AreaField
          label="Notes"
          value={f.notes}
          onChange={(v) => set("notes")(v)}
        />
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
