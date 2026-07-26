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
import type { listDpias } from "@/server/services/gdpr-registers";

type Dpia = Awaited<ReturnType<typeof listDpias>>[number];

const STATUSES = ["draft", "approved", "review_due"];
const RISKS = ["low", "medium", "high"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  draft: "outline",
  approved: "success",
  review_due: "warning",
};
const riskVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

export function DpiaBoard({
  dpias,
  canWrite,
}: {
  dpias: Dpia[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Dpia | "new" | null>(null);

  const tiles = useMemo(
    () => [
      { label: "DPIAs", value: String(dpias.length) },
      {
        label: "Draft",
        value: String(dpias.filter((d) => d.status === "draft").length),
      },
      {
        label: "Approved",
        value: String(dpias.filter((d) => d.status === "approved").length),
      },
      {
        label: "Review due",
        value: String(dpias.filter((d) => d.status === "review_due").length),
      },
    ],
    [dpias],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dpias.filter((d) => {
      if (statusF !== "all" && d.status !== statusF) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !(d.project ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [dpias, search, statusF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Data protection impact assessments for higher-risk processing.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            New DPIA
          </Button>
        )}
      </div>

      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by title or project…"
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
        {dpias.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No DPIAs yet. Assess higher-risk processing before it starts.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No DPIAs match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Residual risk</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((d) => (
                  <TableRow
                    key={d.id}
                    onClick={() => setActive(d)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {d.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.project || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant[d.residualRisk] ?? "outline"}>
                        {d.residualRisk}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(d.reviewDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[d.status] ?? "outline"}>
                        {nice(d.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <DpiaDrawer
        item={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function DpiaDrawer({
  item,
  canWrite,
  onClose,
}: {
  item: Dpia | "new" | null;
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
            <DpiaForm
              dpia={creating ? null : (item as Dpia)}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <DpiaView
              dpia={item as Dpia}
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

function DpiaView({
  dpia: d,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  dpia: Dpia;
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
      const res = await fetch(`/api/gdpr/dpias/${d.id}`, {
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
    if (!window.confirm("Delete this DPIA?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/dpias/${d.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("DPIA deleted");
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
        <SheetTitle>{d.title}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Project">{d.project || "-"}</Field>
          <Field label="Residual risk">
            <Badge variant={riskVariant[d.residualRisk] ?? "outline"}>
              {d.residualRisk}
            </Badge>
          </Field>
          <Field label="Owner">{d.owner || "-"}</Field>
          <Field label="Review date">{fmtDate(d.reviewDate)}</Field>
          <Field label="Status">
            <Badge variant={statusVariant[d.status] ?? "outline"}>
              {nice(d.status)}
            </Badge>
          </Field>
        </dl>
        {d.processingSummary && (
          <Block label="Processing summary" body={d.processingSummary} />
        )}
        {d.necessity && (
          <Block label="Necessity & proportionality" body={d.necessity} />
        )}
        {d.risks && <Block label="Risks" body={d.risks} />}
        {d.controls && (
          <Block label="Controls & mitigations" body={d.controls} />
        )}

        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            {d.status !== "approved" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => patch({ status: "approved" }, "DPIA approved")}
                disabled={busy}
              >
                Approve
              </Button>
            )}
            {d.status !== "review_due" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({ status: "review_due" }, "Flagged for review")
                }
                disabled={busy}
              >
                Flag review
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
        )}
      </div>
    </>
  );
}

function DpiaForm({
  dpia: d,
  onDone,
  onCancel,
}: {
  dpia: Dpia | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: d?.title ?? "",
    project: d?.project ?? "",
    processingSummary: d?.processingSummary ?? "",
    necessity: d?.necessity ?? "",
    risks: d?.risks ?? "",
    controls: d?.controls ?? "",
    residualRisk: d?.residualRisk ?? "low",
    status: d?.status ?? "draft",
    owner: d?.owner ?? "",
    reviewDate: d?.reviewDate ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: f.title,
        project: f.project || null,
        processingSummary: f.processingSummary || null,
        necessity: f.necessity || null,
        risks: f.risks || null,
        controls: f.controls || null,
        residualRisk: f.residualRisk,
        status: f.status,
        owner: f.owner || null,
        reviewDate: f.reviewDate || null,
      };
      const res = await fetch(
        d ? `/api/gdpr/dpias/${d.id}` : "/api/gdpr/dpias",
        {
          method: d ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(d ? "DPIA saved" : "DPIA created");
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
        <SheetTitle>{d ? "Edit DPIA" : "New DPIA"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={set("title")}
          required
        />
        <TextField
          label="Project"
          value={f.project}
          onChange={set("project")}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Residual risk"
            value={f.residualRisk}
            onChange={set("residualRisk")}
            options={RISKS}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Owner" value={f.owner} onChange={set("owner")} />
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={set("reviewDate")}
          />
        </div>
        <AreaField
          label="Processing summary"
          value={f.processingSummary}
          onChange={set("processingSummary")}
        />
        <AreaField
          label="Necessity & proportionality"
          value={f.necessity}
          onChange={set("necessity")}
        />
        <AreaField label="Risks" value={f.risks} onChange={set("risks")} />
        <AreaField
          label="Controls & mitigations"
          value={f.controls}
          onChange={set("controls")}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : d ? "Save changes" : "Create DPIA"}
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
