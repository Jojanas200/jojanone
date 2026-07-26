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
  SwitchField,
  TextField,
  Pager,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import { RowActions } from "./RowActions";
import type { listDueDiligenceItems } from "@/server/services/investor";

type Item = Awaited<ReturnType<typeof listDueDiligenceItems>>[number];

const CATEGORIES = [
  "corporate",
  "financial",
  "legal",
  "compliance",
  "commercial",
  "people",
  "data_room",
];
const STATUSES = [
  "missing",
  "in_progress",
  "ready",
  "needs_review",
  "not_applicable",
];
const PRIORITIES = ["high", "medium", "low"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  missing: "destructive",
  in_progress: "warning",
  ready: "success",
  needs_review: "warning",
  not_applicable: "outline",
};
const priorityVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  high: "destructive",
  medium: "warning",
  low: "success",
};

export function DueDiligenceBoard({
  items,
  canWrite,
}: {
  items: Item[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [categoryF, setCategoryF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const [active, setActive] = useState<Item | "new" | null>(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryF !== "all" && i.category !== categoryF) return false;
      if (statusF !== "all" && i.status !== statusF) return false;
      if (priorityF !== "all" && i.priority !== priorityF) return false;
      if (
        q &&
        !i.title.toLowerCase().includes(q) &&
        !(i.owner ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, search, categoryF, statusF, priorityF]);

  const filtersActive =
    !!search || categoryF !== "all" || statusF !== "all" || priorityF !== "all";

  // Client-side pagination keeps the register readable as records grow.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const paged = shown.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The due-diligence checklist an investor will run.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add item
          </Button>
        )}
      </div>

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by item or owner…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon />
          <FilterSelect
            value={categoryF}
            onChange={setCategoryF}
            allLabel="All categories"
            options={CATEGORIES}
          />
          <FilterSelect
            value={statusF}
            onChange={setStatusF}
            allLabel="Any status"
            options={STATUSES}
          />
          <FilterSelect
            value={priorityF}
            onChange={setPriorityF}
            allLabel="Any priority"
            options={PRIORITIES}
          />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategoryF("all");
                setStatusF("all");
                setPriorityF("all");
              }}
            >
              Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {shown.length} of {items.length}
          </span>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No due-diligence items yet. Build your checklist so a data room is a
            short update, not a scramble.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No items match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((i) => (
                  <TableRow
                    key={i.id}
                    onClick={() => setActive(i)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {i.title}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {nice(i.category)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.required ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[i.priority] ?? "outline"}>
                        {i.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(i.reviewDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[i.status] ?? "outline"}>
                        {nice(i.status)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canWrite && <RowActions id={i.id} status={i.status} />}
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
  const [busy, setBusy] = useState(false);

  async function patch(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/investor-ready/${i.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  function markNotApplicable() {
    const reason = window.prompt(
      "Why does this item not apply? (recorded in notes)",
    );
    if (reason === null) return;
    const note = `Marked N/A: ${reason.trim() || "no reason given"}`;
    void patch(
      {
        status: "not_applicable",
        notes: i.notes ? `${i.notes}\n${note}` : note,
      },
      "Marked not applicable",
    );
  }

  async function remove() {
    if (!window.confirm(`Delete "${i.title}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/investor-ready/${i.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Item deleted");
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
          <Field label="Category">
            <span className="capitalize">{nice(i.category)}</span>
          </Field>
          <Field label="Status">
            <Badge variant={statusVariant[i.status] ?? "outline"}>
              {nice(i.status)}
            </Badge>
          </Field>
          <Field label="Priority">
            <Badge variant={priorityVariant[i.priority] ?? "outline"}>
              {i.priority}
            </Badge>
          </Field>
          <Field label="Required">{i.required ? "Yes" : "No"}</Field>
          <Field label="Owner">{i.owner || "-"}</Field>
          <Field label="Evidence">{i.evidenceReference || "-"}</Field>
          <Field label="Review date">{fmtDate(i.reviewDate)}</Field>
        </dl>
        {i.description && <Block label="Description" body={i.description} />}
        {i.notes && <Block label="Notes" body={i.notes} />}

        {canWrite && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
              {i.status !== "ready" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch({ status: "ready" }, "Marked ready")}
                  disabled={busy}
                >
                  Mark ready
                </Button>
              )}
              {i.status !== "needs_review" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({ status: "needs_review" }, "Marked needs review")
                  }
                  disabled={busy}
                >
                  Needs review
                </Button>
              )}
              {i.status !== "not_applicable" && (
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
    title: i?.title ?? "",
    category: i?.category ?? "corporate",
    status: i?.status ?? "missing",
    priority: i?.priority ?? "medium",
    required: i?.required ?? true,
    owner: i?.owner ?? "",
    description: i?.description ?? "",
    evidenceReference: i?.evidenceReference ?? "",
    reviewDate: i?.reviewDate ?? "",
    notes: i?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: f.title,
        category: f.category,
        status: f.status,
        priority: f.priority,
        required: f.required,
        owner: f.owner || null,
        description: f.description || null,
        evidenceReference: f.evidenceReference || null,
        reviewDate: f.reviewDate || null,
        notes: f.notes || null,
      };
      const res = await fetch(
        i ? `/api/investor-ready/${i.id}` : "/api/investor-ready",
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
      toast.success(i ? "Item saved" : "Item added");
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
          {i ? "Edit due-diligence item" : "New due-diligence item"}
        </SheetTitle>
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
          <SelectField
            label="Priority"
            value={f.priority}
            onChange={(v) => set("priority")(v)}
            options={PRIORITIES}
          />
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
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={(v) => set("reviewDate")(v)}
          />
        </div>
        <AreaField
          label="Description"
          value={f.description}
          onChange={(v) => set("description")(v)}
        />
        <AreaField
          label="Notes"
          value={f.notes}
          onChange={(v) => set("notes")(v)}
        />
        <SwitchField
          label="Required for due diligence"
          checked={f.required}
          onChange={(v) => set("required")(v)}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : i ? "Save changes" : "Add item"}
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
