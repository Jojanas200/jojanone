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
import type { OppOption } from "./OpportunitiesBoard";
import type { listTenderRequirements } from "@/server/services/tender-readiness";

type Req = Awaited<ReturnType<typeof listTenderRequirements>>[number];

const STATUSES = ["not_started", "in_progress", "met", "not_met"];

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  not_started: "outline",
  in_progress: "secondary",
  met: "secondary",
  not_met: "destructive",
};

export function TenderRequirementsBoard({
  requirements,
  canWrite,
  opportunities = [],
}: {
  requirements: Req[];
  canWrite: boolean;
  opportunities?: OppOption[];
}) {
  const oppTitle = useMemo(
    () => new Map(opportunities.map((o) => [o.id, o.title])),
    [opportunities],
  );
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Req | "new" | null>(null);

  const tiles = useMemo(() => {
    const mand = requirements.filter((r) => r.mandatory);
    return [
      { label: "Requirements", value: String(requirements.length) },
      { label: "Mandatory", value: String(mand.length) },
      {
        label: "Met",
        value: String(requirements.filter((r) => r.status === "met").length),
      },
      {
        label: "Not met",
        value: String(mand.filter((r) => r.status === "not_met").length),
      },
    ];
  }, [requirements]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requirements.filter((r) => {
      if (statusF !== "all" && r.status !== statusF) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [requirements, search, statusF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The requirements a tender sets, tracked to met.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add requirement
          </Button>
        )}
      </div>

      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search requirements…"
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
        {requirements.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No requirements captured yet. Add the criteria a tender expects you
            to meet.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No requirements match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead>Weight</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {(r.opportunityId && oppTitle.get(r.opportunityId)) ||
                        "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.requirementType}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.mandatory ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.weighting || "-"}
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

      <ReqDrawer
        item={active}
        canWrite={canWrite}
        opportunities={opportunities}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function ReqDrawer({
  item,
  canWrite,
  opportunities,
  onClose,
}: {
  item: Req | "new" | null;
  canWrite: boolean;
  opportunities: OppOption[];
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
            <ReqForm
              req={creating ? null : (item as Req)}
              opportunities={opportunities}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <ReqView
              req={item as Req}
              canWrite={canWrite}
              opportunities={opportunities}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function ReqView({
  req: r,
  canWrite,
  opportunities,
  onEdit,
  onChanged,
  onClosed,
}: {
  req: Req;
  canWrite: boolean;
  opportunities: OppOption[];
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const oppName = r.opportunityId
    ? opportunities.find((o) => o.id === r.opportunityId)?.title
    : undefined;
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tender/requirements/${r.id}`, {
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
      const res = await fetch(`/api/tender/requirements/${r.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Requirement deleted");
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
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Opportunity">{oppName ?? "-"}</Field>
          <Field label="Type">{r.requirementType}</Field>
          <Field label="Mandatory">{r.mandatory ? "Yes" : "No"}</Field>
          <Field label="Weighting">{r.weighting || "-"}</Field>
          <Field label="Owner">{r.owner || "-"}</Field>
          <Field label="Due">{fmtDate(r.dueDate)}</Field>
          <Field label="Evidence">{r.evidenceReference || "-"}</Field>
          <Field label="Status">
            <Badge variant={statusVariant[r.status] ?? "outline"}>
              {nice(r.status)}
            </Badge>
          </Field>
        </dl>
        {r.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Description
            </p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {r.description}
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

function ReqForm({
  req: r,
  opportunities,
  onDone,
  onCancel,
}: {
  req: Req | null;
  opportunities: OppOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    opportunityId: r?.opportunityId ?? "none",
    requirementType: r?.requirementType ?? "capability",
    title: r?.title ?? "",
    description: r?.description ?? "",
    mandatory: r?.mandatory ?? false,
    weighting: String(r?.weighting ?? 0),
    status: r?.status ?? "not_started",
    owner: r?.owner ?? "",
    dueDate: r?.dueDate ?? "",
    evidenceReference: r?.evidenceReference ?? "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        opportunityId: f.opportunityId === "none" ? null : f.opportunityId,
        requirementType: f.requirementType,
        title: f.title,
        description: f.description || null,
        mandatory: f.mandatory,
        weighting: Number(f.weighting) || 0,
        status: f.status,
        owner: f.owner || null,
        dueDate: f.dueDate || null,
        evidenceReference: f.evidenceReference || null,
      };
      const res = await fetch(
        r ? `/api/tender/requirements/${r.id}` : "/api/tender/requirements",
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
      toast.success(r ? "Requirement saved" : "Requirement added");
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
        <SheetTitle>{r ? "Edit requirement" : "Add requirement"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={(v) => set("title")(v)}
          required
        />
        {opportunities.length > 0 && (
          <SelectField
            label="Opportunity"
            value={f.opportunityId}
            onChange={(v) => set("opportunityId")(v)}
            options={[
              { value: "none", label: "Not linked" },
              ...opportunities.map((o) => ({ value: o.id, label: o.title })),
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Type"
            value={f.requirementType}
            onChange={(v) => set("requirementType")(v)}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={(v) => set("status")(v)}
            options={STATUSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Weighting"
            type="number"
            value={f.weighting}
            onChange={(v) => set("weighting")(v)}
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
            label="Owner"
            value={f.owner}
            onChange={(v) => set("owner")(v)}
          />
          <TextField
            label="Evidence reference"
            value={f.evidenceReference}
            onChange={(v) => set("evidenceReference")(v)}
          />
        </div>
        <AreaField
          label="Description"
          value={f.description}
          onChange={(v) => set("description")(v)}
        />
        <SwitchField
          label="Mandatory requirement"
          checked={f.mandatory}
          onChange={(v) => set("mandatory")(v)}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : r ? "Save changes" : "Add requirement"}
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
