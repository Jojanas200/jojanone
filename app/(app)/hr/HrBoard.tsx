"use client";
import { useMemo, useState } from "react";
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
  Field,
  FilterIcon,
  FilterSelect,
  SearchInput,
  SelectField,
  StatTiles,
  SwitchField,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import type { listEmployees } from "@/server/services/hr";
import type { listHrActions } from "@/server/services/hr-actions";

type Employee = Awaited<ReturnType<typeof listEmployees>>[number];
type HrAction = Awaited<ReturnType<typeof listHrActions>>[number];

const TYPES = ["employee", "contractor", "consultant", "intern"];
const STATUSES = ["active", "probation", "notice", "archived"];
const RTW = ["verified", "outstanding", "expired", "not_required"];
const TRAINING = ["complete", "outstanding", "overdue"];
const CONTRACT = ["signed", "pending", "missing"];
const ACK = ["complete", "outstanding"];
const RISKS = ["low", "medium", "high"];

const rtwVariant: Record<string, "secondary" | "destructive" | "outline"> = {
  verified: "secondary",
  not_required: "outline",
  outstanding: "destructive",
  expired: "destructive",
};
const trainingVariant: Record<string, "secondary" | "destructive" | "outline"> =
  { complete: "secondary", outstanding: "destructive", overdue: "destructive" };
const riskVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
};

const within30 = (d: string | null) => {
  if (!d) return false;
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  return days <= 30;
};
// Started within the last 30 days.
const startedRecently = (d: string | null) => {
  if (!d) return false;
  const days = (Date.now() - new Date(d).getTime()) / 86400000;
  return days >= 0 && days <= 30;
};

export function HrBoard({
  employees,
  actions,
  canWrite,
}: {
  employees: Employee[];
  actions: HrAction[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [deptF, setDeptF] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [active, setActive] = useState<Employee | null>(null);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          employees.map((e) => e.department).filter((d): d is string => !!d),
        ),
      ),
    [employees],
  );

  const tiles = useMemo(() => {
    const live = employees.filter((e) => e.employmentStatus !== "archived");
    return [
      { label: "Active", value: String(live.length) },
      {
        label: "Contractors",
        value: String(
          live.filter((e) => e.employmentType === "contractor").length,
        ),
      },
      {
        label: "New starters (30d)",
        value: String(live.filter((e) => startedRecently(e.startDate)).length),
      },
      {
        label: "Probation reviews",
        value: String(
          live.filter(
            (e) =>
              e.employmentStatus === "probation" ||
              within30(e.probationEndDate),
          ).length,
        ),
      },
      {
        label: "RTW outstanding",
        value: String(
          live.filter(
            (e) =>
              e.rightToWorkStatus === "outstanding" ||
              e.rightToWorkStatus === "expired",
          ).length,
        ),
      },
      {
        label: "Training due",
        value: String(
          live.filter((e) => e.trainingStatus !== "complete").length,
        ),
      },
      {
        label: "Reviews due",
        value: String(live.filter((e) => within30(e.nextReviewDate)).length),
      },
      {
        label: "Handbook missing",
        value: String(
          live.filter((e) => e.policyAcknowledgementStatus !== "complete")
            .length,
        ),
      },
    ];
  }, [employees]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (typeF !== "all" && e.employmentType !== typeF) return false;
      if (statusF !== "all" && e.employmentStatus !== statusF) return false;
      if (deptF !== "all" && e.department !== deptF) return false;
      if (
        q &&
        !e.fullName.toLowerCase().includes(q) &&
        !(e.jobTitle ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [employees, search, typeF, statusF, deptF]);

  const filtersActive =
    !!search || typeF !== "all" || statusF !== "all" || deptF !== "all";

  return (
    <>
      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or role…"
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
          {departments.length > 0 && (
            <FilterSelect
              value={deptF}
              onChange={setDeptF}
              allLabel="All departments"
              options={departments}
            />
          )}
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setTypeF("all");
                setStatusF("all");
                setDeptF("all");
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
              Table
            </Button>
            <Button
              variant={view === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              Cards
            </Button>
          </div>
        </div>
      </div>

      {view === "cards" && employees.length > 0 && shown.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setActive(e)}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-foreground/30"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{e.fullName}</p>
                <Badge variant="outline" className="capitalize">
                  {e.employmentStatus}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.jobTitle || "No job title"}
                {e.department ? ` · ${e.department}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="capitalize">
                  {e.employmentType}
                </Badge>
                <Badge variant={rtwVariant[e.rightToWorkStatus] ?? "outline"}>
                  RTW {nice(e.rightToWorkStatus)}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <Card
        className={`overflow-hidden p-0 ${view === "cards" && employees.length > 0 && shown.length > 0 ? "hidden" : ""}`}
      >
        {employees.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No people yet. Add your team to track right-to-work, training and
            review obligations.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No people match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Right to work</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Risk</TableHead>
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
                      {e.fullName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.jobTitle || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.department || "-"}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {e.employmentStatus}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rtwVariant[e.rightToWorkStatus] ?? "outline"}
                      >
                        {nice(e.rightToWorkStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={trainingVariant[e.trainingStatus] ?? "outline"}
                      >
                        {e.trainingStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant[e.riskLevel] ?? "outline"}>
                        {e.riskLevel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <EmployeeDrawer
        employee={active}
        actions={
          active ? actions.filter((a) => a.employeeId === active.id) : []
        }
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function EmployeeDrawer({
  employee,
  actions,
  canWrite,
  onClose,
}: {
  employee: Employee | null;
  actions: HrAction[];
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
    <Sheet open={!!employee} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {employee &&
          (editing ? (
            <EmployeeEditForm
              employee={employee}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <EmployeeView
              employee={employee}
              actions={actions}
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

function EmployeeView({
  employee: e,
  actions,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  employee: Employee;
  actions: HrAction[];
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/${e.id}`, {
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
    if (!window.confirm(`Remove "${e.fullName}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/${e.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Employee removed");
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
        <SheetTitle>{e.fullName}</SheetTitle>
        <SheetDescription className="capitalize">
          {e.jobTitle || "Team member"} · {e.employmentType}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Department">{e.department || "-"}</Field>
          <Field label="Status">
            <span className="capitalize">{e.employmentStatus}</span>
          </Field>
          <Field label="Started">{fmtDate(e.startDate)}</Field>
          <Field label="Probation ends">{fmtDate(e.probationEndDate)}</Field>
          <Field label="Contract">
            <span className="capitalize">{e.contractStatus}</span>
          </Field>
          <Field label="Right to work">
            <Badge variant={rtwVariant[e.rightToWorkStatus] ?? "outline"}>
              {nice(e.rightToWorkStatus)}
            </Badge>
          </Field>
          <Field label="RTW expiry">{fmtDate(e.rightToWorkExpiry)}</Field>
          <Field label="Training">
            <Badge variant={trainingVariant[e.trainingStatus] ?? "outline"}>
              {e.trainingStatus}
            </Badge>
          </Field>
          <Field label="Handbook signed">
            {e.policyAcknowledgementStatus === "complete" ? "Yes" : "No"}
          </Field>
          <Field label="Emergency contact">
            {e.emergencyContactRecorded ? "Recorded" : "Missing"}
          </Field>
          <Field label="Next review">{fmtDate(e.nextReviewDate)}</Field>
          <Field label="Risk">
            <Badge variant={riskVariant[e.riskLevel] ?? "outline"}>
              {e.riskLevel}
            </Badge>
          </Field>
        </dl>
        {e.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {e.notes}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground">
            HR actions
          </p>
          {actions.length === 0 ? (
            <p className="mt-1 text-muted-foreground">
              No actions recorded. Add one from the Actions tab.
            </p>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {actions.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {a.title}
                    </span>
                    <span className="text-[11px] capitalize text-muted-foreground">
                      {nice(a.actionType)}
                      {a.dueDate ? ` · due ${fmtDate(a.dueDate)}` : ""}
                    </span>
                  </span>
                  <Badge
                    variant={
                      a.status === "completed"
                        ? "secondary"
                        : a.status === "in_progress"
                          ? "default"
                          : "destructive"
                    }
                    className="shrink-0 capitalize"
                  >
                    {nice(a.status)}
                  </Badge>
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
              <Button
                size="sm"
                variant="outline"
                onClick={remove}
                disabled={busy}
              >
                Remove
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.rightToWorkStatus !== "verified" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() =>
                    patch({ rightToWorkStatus: "verified" }, "RTW verified")
                  }
                  disabled={busy}
                >
                  Verify RTW
                </Button>
              )}
              {e.trainingStatus !== "complete" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() =>
                    patch({ trainingStatus: "complete" }, "Training complete")
                  }
                  disabled={busy}
                >
                  Training done
                </Button>
              )}
              {e.policyAcknowledgementStatus !== "complete" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() =>
                    patch(
                      { policyAcknowledgementStatus: "complete" },
                      "Handbook signed",
                    )
                  }
                  disabled={busy}
                >
                  Handbook signed
                </Button>
              )}
              {!e.emergencyContactRecorded && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() =>
                    patch(
                      { emergencyContactRecorded: true },
                      "Emergency contact recorded",
                    )
                  }
                  disabled={busy}
                >
                  Record emergency contact
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 90);
                  patch(
                    { nextReviewDate: d.toISOString().slice(0, 10) },
                    "Review recorded - next due in 90 days",
                  );
                }}
                disabled={busy}
              >
                Record review (+90d)
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function EmployeeEditForm({
  employee: e,
  onDone,
  onCancel,
}: {
  employee: Employee;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    fullName: e.fullName,
    jobTitle: e.jobTitle ?? "",
    department: e.department ?? "",
    employmentType: e.employmentType,
    employmentStatus: e.employmentStatus,
    startDate: e.startDate ?? "",
    probationEndDate: e.probationEndDate ?? "",
    contractStatus: e.contractStatus,
    rightToWorkStatus: e.rightToWorkStatus,
    rightToWorkExpiry: e.rightToWorkExpiry ?? "",
    policyAcknowledgementStatus: e.policyAcknowledgementStatus,
    trainingStatus: e.trainingStatus,
    nextReviewDate: e.nextReviewDate ?? "",
    riskLevel: e.riskLevel,
    emergencyContactRecorded: e.emergencyContactRecorded,
    notes: e.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/hr/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: f.fullName,
          jobTitle: f.jobTitle || null,
          department: f.department || null,
          employmentType: f.employmentType,
          employmentStatus: f.employmentStatus,
          startDate: f.startDate || null,
          probationEndDate: f.probationEndDate || null,
          contractStatus: f.contractStatus,
          rightToWorkStatus: f.rightToWorkStatus,
          rightToWorkExpiry: f.rightToWorkExpiry || null,
          policyAcknowledgementStatus: f.policyAcknowledgementStatus,
          trainingStatus: f.trainingStatus,
          nextReviewDate: f.nextReviewDate || null,
          riskLevel: f.riskLevel,
          emergencyContactRecorded: f.emergencyContactRecorded,
          notes: f.notes || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Employee saved");
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
        <SheetTitle>Edit person</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Full name"
          value={f.fullName}
          onChange={(v) => set("fullName")(v)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Job title"
            value={f.jobTitle}
            onChange={(v) => set("jobTitle")(v)}
          />
          <TextField
            label="Department"
            value={f.department}
            onChange={(v) => set("department")(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Type"
            value={f.employmentType}
            onChange={(v) => set("employmentType")(v)}
            options={TYPES}
          />
          <SelectField
            label="Status"
            value={f.employmentStatus}
            onChange={(v) => set("employmentStatus")(v)}
            options={STATUSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Start date"
            type="date"
            value={f.startDate}
            onChange={(v) => set("startDate")(v)}
          />
          <TextField
            label="Probation ends"
            type="date"
            value={f.probationEndDate}
            onChange={(v) => set("probationEndDate")(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Contract"
            value={f.contractStatus}
            onChange={(v) => set("contractStatus")(v)}
            options={CONTRACT}
          />
          <SelectField
            label="Right to work"
            value={f.rightToWorkStatus}
            onChange={(v) => set("rightToWorkStatus")(v)}
            options={RTW}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="RTW expiry"
            type="date"
            value={f.rightToWorkExpiry}
            onChange={(v) => set("rightToWorkExpiry")(v)}
          />
          <TextField
            label="Next review"
            type="date"
            value={f.nextReviewDate}
            onChange={(v) => set("nextReviewDate")(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Handbook"
            value={f.policyAcknowledgementStatus}
            onChange={(v) => set("policyAcknowledgementStatus")(v)}
            options={ACK}
          />
          <SelectField
            label="Training"
            value={f.trainingStatus}
            onChange={(v) => set("trainingStatus")(v)}
            options={TRAINING}
          />
        </div>
        <SelectField
          label="Risk level"
          value={f.riskLevel}
          onChange={(v) => set("riskLevel")(v)}
          options={RISKS}
        />
        <SwitchField
          label="Emergency contact recorded"
          checked={f.emergencyContactRecorded}
          onChange={(v) => set("emergencyContactRecorded")(v)}
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
