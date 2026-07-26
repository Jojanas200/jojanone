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
  SwitchField,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import type { listDataRequests } from "@/server/services/gdpr-registers";

type Request_ = Awaited<ReturnType<typeof listDataRequests>>[number];

const TYPES = [
  "subject_access",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability",
];
const STATUSES = ["open", "in_progress", "completed", "closed"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  open: "warning",
  in_progress: "warning",
  completed: "success",
  closed: "success",
};

const isLive = (s: string) => s === "open" || s === "in_progress";
const daysTo = (d: string) => (new Date(d).getTime() - Date.now()) / 86400000;

export function DataRequestsBoard({
  requests,
  canWrite,
}: {
  requests: Request_[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Request_ | "new" | null>(null);

  const tiles = useMemo(() => {
    const live = requests.filter((r) => isLive(r.status));
    return [
      {
        label: "Open",
        value: String(requests.filter((r) => r.status === "open").length),
      },
      {
        label: "In progress",
        value: String(
          requests.filter((r) => r.status === "in_progress").length,
        ),
      },
      {
        label: "Due ≤7d",
        value: String(
          live.filter((r) => daysTo(r.dueDate) >= 0 && daysTo(r.dueDate) <= 7)
            .length,
        ),
      },
      {
        label: "Overdue",
        value: String(live.filter((r) => daysTo(r.dueDate) < 0).length),
      },
      {
        label: "Completed",
        value: String(requests.filter((r) => r.status === "completed").length),
      },
    ];
  }, [requests]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusF !== "all" && r.status !== statusF) return false;
      if (
        q &&
        !(r.requesterReference ?? "").toLowerCase().includes(q) &&
        !nice(r.requestType).toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [requests, search, statusF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Data subject rights requests, tracked against the one-month statutory
          deadline.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            New request
          </Button>
        )}
      </div>

      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by reference or type…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon />
          <FilterSelect
            value={statusF}
            onChange={setStatusF}
            allLabel="Any status"
            options={STATUSES}
          />
          {(search || statusF !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusF("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {requests.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No requests logged yet. Record DSARs to track them against the
            one-month deadline.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No requests match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Due</TableHead>
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
                    <TableCell className="font-medium capitalize text-foreground">
                      {nice(r.requestType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.requesterReference || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(r.receivedDate)}
                    </TableCell>
                    <TableCell
                      className={
                        isLive(r.status) && daysTo(r.dueDate) < 0
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {fmtDate(r.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status] ?? "outline"}>
                        {nice(r.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <RequestDrawer
        item={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function RequestDrawer({
  item,
  canWrite,
  onClose,
}: {
  item: Request_ | "new" | null;
  canWrite: boolean;
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
            <RequestForm
              request={creating ? null : (item as Request_)}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <RequestView
              request={item as Request_}
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

function RequestView({
  request: r,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  request: Request_;
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
      const res = await fetch(`/api/gdpr/requests/${r.id}`, {
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
    if (!window.confirm("Delete this request?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/requests/${r.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Request deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const overdue = isLive(r.status) && daysTo(r.dueDate) < 0;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="capitalize">
          {nice(r.requestType)} request
        </SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Reference">{r.requesterReference || "-"}</Field>
          <Field label="Received">{fmtDate(r.receivedDate)}</Field>
          <Field label="Due">
            <span className={overdue ? "font-medium text-destructive" : ""}>
              {fmtDate(r.dueDate)}
              {overdue ? " (overdue)" : ""}
            </span>
          </Field>
          <Field label="Identity verified">
            {r.identityVerified ? "Yes" : "No"}
          </Field>
          <Field label="Owner">{r.assignedOwner || "-"}</Field>
          <Field label="Status">
            <Badge variant={statusVariant[r.status] ?? "outline"}>
              {nice(r.status)}
            </Badge>
          </Field>
          {r.completedAt && (
            <Field label="Completed">{fmtDate(r.completedAt)}</Field>
          )}
        </dl>
        {r.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {r.notes}
            </p>
          </div>
        )}

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
                  onClick={() => patch({ status: s }, "Status updated")}
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

function RequestForm({
  request: r,
  onDone,
  onCancel,
}: {
  request: Request_ | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    requestType: r?.requestType ?? "subject_access",
    requesterReference: r?.requesterReference ?? "",
    receivedDate: r?.receivedDate ?? new Date().toISOString().slice(0, 10),
    dueDate: r?.dueDate ?? "",
    identityVerified: r?.identityVerified ?? false,
    status: r?.status ?? "open",
    assignedOwner: r?.assignedOwner ?? "",
    notes: r?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        requestType: f.requestType,
        requesterReference: f.requesterReference || null,
        receivedDate: f.receivedDate,
        identityVerified: f.identityVerified,
        status: f.status,
        assignedOwner: f.assignedOwner || null,
        notes: f.notes || null,
      };
      if (f.dueDate) payload.dueDate = f.dueDate;
      const res = await fetch(
        r ? `/api/gdpr/requests/${r.id}` : "/api/gdpr/requests",
        {
          method: r ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(r ? "Request saved" : "Request logged");
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
        <SheetTitle>{r ? "Edit request" : "New data request"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <SelectField
          label="Request type"
          value={f.requestType}
          onChange={(v) => set("requestType")(v)}
          options={TYPES}
        />
        <TextField
          label="Requester reference"
          value={f.requesterReference}
          onChange={(v) => set("requesterReference")(v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Received date"
            type="date"
            value={f.receivedDate}
            onChange={(v) => set("receivedDate")(v)}
            required
          />
          <TextField
            label="Due date (auto +1 month)"
            type="date"
            value={f.dueDate}
            onChange={(v) => set("dueDate")(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            value={f.status}
            onChange={(v) => set("status")(v)}
            options={STATUSES}
          />
          <TextField
            label="Owner"
            value={f.assignedOwner}
            onChange={(v) => set("assignedOwner")(v)}
          />
        </div>
        <SwitchField
          label="Identity verified"
          checked={f.identityVerified}
          onChange={(v) => set("identityVerified")(v)}
        />
        <AreaField
          label="Notes"
          value={f.notes}
          onChange={(v) => set("notes")(v)}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : r ? "Save changes" : "Log request"}
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
