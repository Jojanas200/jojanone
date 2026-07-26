"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import type { listHrActions } from "@/server/services/hr-actions";

type HrAction = Awaited<ReturnType<typeof listHrActions>>[number];
type EmpOption = { id: string; fullName: string };

const TYPES = [
  "right_to_work",
  "probation_review",
  "contract_issue",
  "training",
  "policy_ack",
  "performance_review",
  "return_to_work",
  "welfare",
  "document_renewal",
];
const STATUSES = ["open", "in_progress", "completed"];
const PRIORITIES = ["high", "medium", "low", "none"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  open: "warning",
  in_progress: "warning",
  completed: "success",
};
const priorityVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = { high: "destructive", medium: "warning", low: "success", none: "outline" };

const overdue = (d: string | null, status: string) =>
  !!d && status !== "completed" && new Date(d).getTime() < Date.now();

export function HrActionsBoard({
  actions,
  employees,
  canWrite,
}: {
  actions: HrAction[];
  employees: EmpOption[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [active, setActive] = useState<HrAction | "new" | null>(null);

  const nameOf = useMemo(() => {
    const m = new Map(employees.map((e) => [e.id, e.fullName]));
    return (id: string | null) => (id ? (m.get(id) ?? "-") : "-");
  }, [employees]);

  const tiles = useMemo(() => {
    const live = actions.filter((a) => a.status !== "completed");
    return [
      {
        label: "Open",
        value: String(actions.filter((a) => a.status === "open").length),
      },
      {
        label: "In progress",
        value: String(actions.filter((a) => a.status === "in_progress").length),
      },
      {
        label: "Overdue",
        value: String(live.filter((a) => overdue(a.dueDate, a.status)).length),
      },
      {
        label: "Completed",
        value: String(actions.filter((a) => a.status === "completed").length),
      },
    ];
  }, [actions]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actions.filter((a) => {
      if (statusF !== "all" && a.status !== statusF) return false;
      if (typeF !== "all" && a.actionType !== typeF) return false;
      if (q && !a.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [actions, search, statusF, typeF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          People tasks - right-to-work checks, probation reviews, training and
          welfare follow-ups.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            New action
          </Button>
        )}
      </div>

      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search actions…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon />
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
          {(search || statusF !== "all" || typeF !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusF("all");
                setTypeF("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {actions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No people actions yet. Track right-to-work, probation, training and
            welfare tasks here.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No actions match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => (
                  <TableRow
                    key={a.id}
                    onClick={() => setActive(a)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {a.title}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {nice(a.actionType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {nameOf(a.employeeId)}
                    </TableCell>
                    <TableCell
                      className={
                        overdue(a.dueDate, a.status)
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {fmtDate(a.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[a.priority] ?? "outline"}>
                        {a.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] ?? "outline"}>
                        {nice(a.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ActionDrawer
        item={active}
        employees={employees}
        canWrite={canWrite}
        nameOf={nameOf}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function ActionDrawer({
  item,
  employees,
  canWrite,
  nameOf,
  onClose,
}: {
  item: HrAction | "new" | null;
  employees: EmpOption[];
  canWrite: boolean;
  nameOf: (id: string | null) => string;
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
            <ActionForm
              action={creating ? null : (item as HrAction)}
              employees={employees}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <ActionView
              action={item as HrAction}
              canWrite={canWrite}
              nameOf={nameOf}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function ActionView({
  action: a,
  canWrite,
  nameOf,
  onEdit,
  onChanged,
  onClosed,
}: {
  action: HrAction;
  canWrite: boolean;
  nameOf: (id: string | null) => string;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/actions/${a.id}`, {
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
    if (!window.confirm("Delete this action?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/actions/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Action deleted");
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
        <SheetTitle>{a.title}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Type">
            <span className="capitalize">{nice(a.actionType)}</span>
          </Field>
          <Field label="Person">{nameOf(a.employeeId)}</Field>
          <Field label="Priority">
            <span className="capitalize">{a.priority}</span>
          </Field>
          <Field label="Due">{fmtDate(a.dueDate)}</Field>
          <Field label="Status">
            <Badge variant={statusVariant[a.status] ?? "outline"}>
              {nice(a.status)}
            </Badge>
          </Field>
          {a.completedAt && (
            <Field label="Completed">{fmtDate(a.completedAt)}</Field>
          )}
        </dl>
        {a.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Description
            </p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {a.description}
            </p>
          </div>
        )}
        {a.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {a.notes}
            </p>
          </div>
        )}

        {canWrite && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
              {a.status !== "completed" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({ status: "completed" }, "Marked complete")
                    }
                    disabled={busy}
                  >
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const d = window.prompt(
                        "Defer until (YYYY-MM-DD)?",
                        a.dueDate ?? "",
                      );
                      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
                      patch({ dueDate: d, status: "open" }, `Deferred to ${d}`);
                    }}
                    disabled={busy}
                  >
                    Defer
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch({ status: "open" }, "Reopened")}
                  disabled={busy}
                >
                  Reopen
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

function ActionForm({
  action: a,
  employees,
  onDone,
  onCancel,
}: {
  action: HrAction | null;
  employees: EmpOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    actionType: a?.actionType ?? "right_to_work",
    title: a?.title ?? "",
    description: a?.description ?? "",
    employeeId: a?.employeeId ?? "none",
    priority: a?.priority ?? "medium",
    status: a?.status ?? "open",
    dueDate: a?.dueDate ?? "",
    notes: a?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  const employeeOptions = [
    { value: "none", label: "No specific person" },
    ...employees.map((e) => ({ value: e.id, label: e.fullName })),
  ];

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        actionType: f.actionType,
        title: f.title,
        description: f.description || null,
        employeeId: f.employeeId === "none" ? null : f.employeeId,
        priority: f.priority,
        status: f.status,
        dueDate: f.dueDate || null,
        notes: f.notes || null,
      };
      const res = await fetch(
        a ? `/api/hr/actions/${a.id}` : "/api/hr/actions",
        {
          method: a ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(a ? "Action saved" : "Action created");
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
        <SheetTitle>{a ? "Edit action" : "New people action"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={set("title")}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Type"
            value={f.actionType}
            onChange={set("actionType")}
            options={TYPES}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
        </div>
        <SelectField
          label="Person"
          value={f.employeeId}
          onChange={set("employeeId")}
          options={employeeOptions}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Priority"
            value={f.priority}
            onChange={set("priority")}
            options={PRIORITIES}
          />
          <TextField
            label="Due date"
            type="date"
            value={f.dueDate}
            onChange={set("dueDate")}
          />
        </div>
        <AreaField
          label="Description"
          value={f.description}
          onChange={set("description")}
        />
        <AreaField label="Notes" value={f.notes} onChange={set("notes")} />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : a ? "Save changes" : "Create action"}
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
