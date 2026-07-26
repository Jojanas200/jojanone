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
import { printDocument } from "../_shared/print";
import type { listDataRoomItems } from "@/server/services/investor-readiness";

type Item = Awaited<ReturnType<typeof listDataRoomItems>>[number];

const STATUSES = ["missing", "requested", "in_progress", "ready"];
const CONF = ["standard", "confidential", "restricted"];

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  missing: "destructive",
  requested: "outline",
  in_progress: "secondary",
  ready: "secondary",
};

export function DataRoomBoard({
  items,
  canWrite,
}: {
  items: Item[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Item | "new" | null>(null);

  const tiles = useMemo(
    () => [
      { label: "Documents", value: String(items.length) },
      {
        label: "Ready",
        value: String(items.filter((i) => i.status === "ready").length),
      },
      {
        label: "In progress",
        value: String(items.filter((i) => i.status === "in_progress").length),
      },
      {
        label: "Missing",
        value: String(items.filter((i) => i.status === "missing").length),
      },
    ],
    [items],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (statusF !== "all" && i.status !== statusF) return false;
      if (
        q &&
        !i.title.toLowerCase().includes(q) &&
        !i.folder.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, search, statusF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The documents an investor will expect to see, tracked to ready.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              printDocument({
                title: "Data room index",
                meta: `${items.length} documents`,
                blocks: [
                  {
                    kind: "table",
                    columns: [
                      "Folder",
                      "Document",
                      "Type",
                      "Version",
                      "Status",
                      "Review",
                    ],
                    rows: [...items]
                      .sort(
                        (a, b) =>
                          a.folder.localeCompare(b.folder) ||
                          a.title.localeCompare(b.title),
                      )
                      .map((i) => [
                        i.folder,
                        i.title,
                        i.documentType ?? "-",
                        i.version,
                        nice(i.status),
                        fmtDate(i.reviewDate),
                      ]),
                  },
                ],
              })
            }
            disabled={items.length === 0}
          >
            Print index
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setActive("new")}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add document
            </Button>
          )}
        </div>
      </div>

      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by document or folder…"
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
        {items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No data-room documents yet. Build the checklist an investor will
            expect.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No documents match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Folder</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((i) => (
                  <TableRow
                    key={i.id}
                    onClick={() => setActive(i)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {i.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.folder}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      v{i.version}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[i.status] ?? "outline"}>
                        {nice(i.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ItemDrawer
        item={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function ItemDrawer({
  item,
  canWrite,
  onClose,
}: {
  item: Item | "new" | null;
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
            <ItemForm
              item={creating ? null : (item as Item)}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <ItemView
              item={item as Item}
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

function ItemView({
  item: i,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  item: Item;
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
      const res = await fetch(`/api/investor/data-room/${i.id}`, {
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
    if (!window.confirm(`Delete "${i.title}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/investor/data-room/${i.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Document removed");
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
        <SheetTitle>{i.title}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Folder">{i.folder}</Field>
          <Field label="Type">{i.documentType || "-"}</Field>
          <Field label="Version">v{i.version}</Field>
          <Field label="Confidentiality">
            <span className="capitalize">{i.confidentiality}</span>
          </Field>
          <Field label="Status">
            <Badge variant={statusVariant[i.status] ?? "outline"}>
              {nice(i.status)}
            </Badge>
          </Field>
          <Field label="Review">{fmtDate(i.reviewDate)}</Field>
        </dl>
        {i.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {i.notes}
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
              {STATUSES.filter((s) => s !== i.status).map((s) => (
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

function ItemForm({
  item: i,
  onDone,
  onCancel,
}: {
  item: Item | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    folder: i?.folder ?? "",
    title: i?.title ?? "",
    documentType: i?.documentType ?? "",
    version: i?.version ?? "1.0",
    status: i?.status ?? "missing",
    confidentiality: i?.confidentiality ?? "standard",
    reviewDate: i?.reviewDate ?? "",
    notes: i?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        folder: f.folder,
        title: f.title,
        documentType: f.documentType || null,
        version: f.version || "1.0",
        status: f.status,
        confidentiality: f.confidentiality,
        reviewDate: f.reviewDate || null,
        notes: f.notes || null,
      };
      const res = await fetch(
        i ? `/api/investor/data-room/${i.id}` : "/api/investor/data-room",
        {
          method: i ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(i ? "Document saved" : "Document added");
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
        <SheetTitle>
          {i ? "Edit document" : "Add data-room document"}
        </SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={set("title")}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Folder"
            value={f.folder}
            onChange={set("folder")}
            required
          />
          <TextField
            label="Document type"
            value={f.documentType}
            onChange={set("documentType")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
          <SelectField
            label="Confidentiality"
            value={f.confidentiality}
            onChange={set("confidentiality")}
            options={CONF}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Version"
            value={f.version}
            onChange={set("version")}
          />
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={set("reviewDate")}
          />
        </div>
        <AreaField label="Notes" value={f.notes} onChange={set("notes")} />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : i ? "Save changes" : "Add document"}
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
