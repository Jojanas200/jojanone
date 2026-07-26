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
  Block,
  Field,
  FilterIcon,
  FilterSelect,
  SearchInput,
  SelectField,
  StatTiles,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import type { listGovernanceRecords } from "@/server/services/governance";

type Record_ = Awaited<ReturnType<typeof listGovernanceRecords>>[number];

const TYPES = [
  "board_meeting",
  "written_resolution",
  "director_decision",
  "shareholder_decision",
  "meeting_minutes",
  "governance_review",
];
const STATUSES = [
  "draft",
  "pending",
  "approved",
  "deferred",
  "rejected",
  "completed",
];

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  draft: "outline",
  pending: "secondary",
  approved: "secondary",
  completed: "secondary",
  deferred: "outline",
  rejected: "destructive",
};

export function GovernanceBoard({
  records,
  canWrite,
}: {
  records: Record_[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Record_ | null>(null);

  const tiles = useMemo(
    () => [
      { label: "Records", value: String(records.length) },
      {
        label: "Awaiting approval",
        value: String(
          records.filter((r) => r.status === "draft" || r.status === "pending")
            .length,
        ),
      },
      {
        label: "Approved",
        value: String(records.filter((r) => r.status === "approved").length),
      },
      {
        label: "Completed",
        value: String(records.filter((r) => r.status === "completed").length),
      },
    ],
    [records],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (typeF !== "all" && r.recordType !== typeF) return false;
      if (statusF !== "all" && r.status !== statusF) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !(r.decisionMaker ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [records, search, typeF, statusF]);

  const filtersActive = !!search || typeF !== "all" || statusF !== "all";

  return (
    <>
      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by title or decision maker…"
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
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setTypeF("all");
                setStatusF("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {records.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No records yet. Log board meetings, resolutions and decisions to
            keep an audit-ready trail.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No records match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Decision maker</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => setActive(r)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {r.title}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {nice(r.recordType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(r.meetingDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.decisionMaker || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status] ?? "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <RecordDrawer
        record={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function RecordDrawer({
  record,
  canWrite,
  onClose,
}: {
  record: Record_ | null;
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
    <Sheet open={!!record} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {record &&
          (editing ? (
            <RecordEditForm
              record={record}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <RecordView
              record={record}
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

function RecordView({
  record: r,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  record: Record_;
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/governance/${r.id}`, {
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

  async function remove() {
    if (!window.confirm(`Delete "${r.title}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/governance/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Record deleted");
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
        <SheetTitle>{r.title}</SheetTitle>
        <SheetDescription className="capitalize">
          {nice(r.recordType)} · {r.status}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Meeting date">{fmtDate(r.meetingDate)}</Field>
          <Field label="Decision date">{fmtDate(r.decisionDate)}</Field>
          <Field label="Review date">{fmtDate(r.reviewDate)}</Field>
          <Field label="Owner">{r.owner || "-"}</Field>
          <Field label="Decision maker">{r.decisionMaker || "-"}</Field>
        </dl>
        {r.participants && <Block label="Participants" body={r.participants} />}
        {r.description && <Block label="Description" body={r.description} />}
        {r.background && <Block label="Background" body={r.background} />}
        {r.optionsConsidered && (
          <Block label="Options considered" body={r.optionsConsidered} />
        )}
        {r.risksConsidered && (
          <Block label="Risks considered" body={r.risksConsidered} />
        )}
        {r.decision && <Block label="Decision" body={r.decision} />}
        {r.actions && <Block label="Actions" body={r.actions} />}
        {r.notes && <Block label="Notes" body={r.notes} />}

        {canWrite && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
              {r.status !== "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus("approved")}
                  disabled={busy}
                >
                  Approve
                </Button>
              )}
              {r.status !== "deferred" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus("deferred")}
                  disabled={busy}
                >
                  Defer
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Set status:</span>
              {STATUSES.filter((s) => s !== r.status).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="ghost"
                  className="h-7 capitalize"
                  onClick={() => setStatus(s)}
                  disabled={busy}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function RecordEditForm({
  record: r,
  onDone,
  onCancel,
}: {
  record: Record_;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    recordType: r.recordType,
    title: r.title,
    description: r.description ?? "",
    meetingDate: r.meetingDate ?? "",
    decisionDate: r.decisionDate ?? "",
    reviewDate: r.reviewDate ?? "",
    owner: r.owner ?? "",
    decisionMaker: r.decisionMaker ?? "",
    participants: r.participants ?? "",
    background: r.background ?? "",
    optionsConsidered: r.optionsConsidered ?? "",
    risksConsidered: r.risksConsidered ?? "",
    decision: r.decision ?? "",
    actions: r.actions ?? "",
    notes: r.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));
  const isDirector = f.recordType === "director_decision";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/governance/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: f.recordType,
          title: f.title,
          description: f.description || null,
          meetingDate: f.meetingDate || null,
          decisionDate: f.decisionDate || null,
          reviewDate: f.reviewDate || null,
          owner: f.owner || null,
          decisionMaker: f.decisionMaker || null,
          participants: f.participants || null,
          background: f.background || null,
          optionsConsidered: f.optionsConsidered || null,
          risksConsidered: f.risksConsidered || null,
          decision: f.decision || null,
          actions: f.actions || null,
          notes: f.notes || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Record saved");
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
        <SheetTitle>Edit record</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={set("title")}
          required
        />
        <SelectField
          label="Type"
          value={f.recordType}
          onChange={set("recordType")}
          options={TYPES}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Meeting date"
            type="date"
            value={f.meetingDate}
            onChange={set("meetingDate")}
          />
          <TextField
            label="Decision date"
            type="date"
            value={f.decisionDate}
            onChange={set("decisionDate")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={set("reviewDate")}
          />
          <TextField label="Owner" value={f.owner} onChange={set("owner")} />
        </div>
        <TextField
          label="Decision maker"
          value={f.decisionMaker}
          onChange={set("decisionMaker")}
        />
        <AreaField
          label="Participants"
          value={f.participants}
          onChange={set("participants")}
        />
        <AreaField
          label="Description"
          value={f.description}
          onChange={set("description")}
        />
        {isDirector && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Director decision record
            </p>
            <AreaField
              label="Background"
              value={f.background}
              onChange={set("background")}
            />
            <AreaField
              label="Options considered"
              value={f.optionsConsidered}
              onChange={set("optionsConsidered")}
            />
            <AreaField
              label="Risks considered"
              value={f.risksConsidered}
              onChange={set("risksConsidered")}
            />
          </div>
        )}
        <AreaField
          label="Decision"
          value={f.decision}
          onChange={set("decision")}
        />
        <AreaField
          label="Actions"
          value={f.actions}
          onChange={set("actions")}
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
