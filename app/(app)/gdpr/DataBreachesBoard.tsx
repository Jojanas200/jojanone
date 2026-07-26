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
  SwitchField,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import type { listDataBreaches } from "@/server/services/gdpr-registers";

type Breach = Awaited<ReturnType<typeof listDataBreaches>>[number];

const STATUSES = ["open", "contained", "closed"];
const RISKS = ["low", "medium", "high"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  open: "destructive",
  contained: "warning",
  closed: "success",
};
const riskVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

const asDay = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
const hoursSince = (d: string | Date) =>
  (Date.now() - new Date(d).getTime()) / 3_600_000;
// The 72h ICO reporting clock runs from becoming aware (discovered_at).
const past72h = (b: Breach) =>
  b.status !== "closed" && hoursSince(b.discoveredAt) > 72;

export function DataBreachesBoard({
  breaches,
  canWrite,
}: {
  breaches: Breach[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Breach | "new" | null>(null);

  const tiles = useMemo(
    () => [
      { label: "Breaches", value: String(breaches.length) },
      {
        label: "Open",
        value: String(breaches.filter((b) => b.status === "open").length),
      },
      {
        label: "High risk",
        value: String(breaches.filter((b) => b.riskLevel === "high").length),
      },
      {
        label: "Past 72h",
        value: String(breaches.filter(past72h).length),
      },
    ],
    [breaches],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return breaches.filter((b) => {
      if (statusF !== "all" && b.status !== statusF) return false;
      if (q && !b.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [breaches, search, statusF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Personal data breach log. The ICO must be told within 72 hours of you
          becoming aware, where the breach is likely to be a risk.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Log breach
          </Button>
        )}
      </div>

      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search breaches…"
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
        {breaches.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No breaches logged. Record any personal data breach here to manage
            the 72-hour reporting decision.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No breaches match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Breach</TableHead>
                  <TableHead>Discovered</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Affected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((b) => (
                  <TableRow
                    key={b.id}
                    onClick={() => setActive(b)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {b.title}
                      {past72h(b) && (
                        <Badge variant="destructive" className="ml-2">
                          72h elapsed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(b.discoveredAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant[b.riskLevel] ?? "outline"}>
                        {b.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.affectedPeopleEstimate || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[b.status] ?? "outline"}>
                        {b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <BreachDrawer
        item={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function BreachDrawer({
  item,
  canWrite,
  onClose,
}: {
  item: Breach | "new" | null;
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
            <BreachForm
              breach={creating ? null : (item as Breach)}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <BreachView
              breach={item as Breach}
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

function BreachView({
  breach: b,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  breach: Breach;
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
      const res = await fetch(`/api/gdpr/breaches/${b.id}`, {
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
    if (!window.confirm("Delete this breach record?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/breaches/${b.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Breach deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function printBreach() {
    const blocks: PrintBlock[] = [
      {
        kind: "rows",
        rows: [
          ["Discovered", fmtDate(b.discoveredAt)],
          ["Occurred", fmtDate(b.occurredAt)],
          ["Risk level", b.riskLevel],
          ["People affected", String(b.affectedPeopleEstimate || "-")],
          ["Status", b.status],
          ["Owner", b.owner || "-"],
          [
            "Professional support",
            b.professionalSupportRequired ? "Recommended" : "Not flagged",
          ],
        ],
      },
    ];
    if (b.description)
      blocks.push({
        kind: "text",
        heading: "Description",
        body: b.description,
      });
    if (b.dataInvolved)
      blocks.push({
        kind: "text",
        heading: "Data involved",
        body: b.dataInvolved,
      });
    if (b.containmentActions)
      blocks.push({
        kind: "text",
        heading: "Containment actions",
        body: b.containmentActions,
      });
    if (b.icoNotificationAssessment)
      blocks.push({
        kind: "text",
        heading: "ICO notification assessment",
        body: b.icoNotificationAssessment,
      });
    if (b.individualNotificationAssessment)
      blocks.push({
        kind: "text",
        heading: "Individual notification assessment",
        body: b.individualNotificationAssessment,
      });
    printDocument({
      title: b.title,
      meta: `Data breach record · ${b.riskLevel} risk · ${nice(b.status)}`,
      blocks,
      disclaimer:
        "Notification decisions may need professional data-protection or legal judgement.",
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{b.title}</SheetTitle>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printBreach}>
          Print
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        {past72h(b) && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            More than 72 hours since discovery. If this breach is likely to risk
            people&apos;s rights, the ICO should already have been told.
          </div>
        )}
        <dl className="space-y-3">
          <Field label="Discovered">{fmtDate(b.discoveredAt)}</Field>
          <Field label="Occurred">{fmtDate(b.occurredAt)}</Field>
          <Field label="Risk level">
            <Badge variant={riskVariant[b.riskLevel] ?? "outline"}>
              {b.riskLevel}
            </Badge>
          </Field>
          <Field label="People affected">
            {b.affectedPeopleEstimate || "-"}
          </Field>
          <Field label="Owner">{b.owner || "-"}</Field>
          <Field label="Professional support">
            {b.professionalSupportRequired ? "Recommended" : "Not flagged"}
          </Field>
          <Field label="Status">
            <Badge variant={statusVariant[b.status] ?? "outline"}>
              {b.status}
            </Badge>
          </Field>
        </dl>
        {b.description && <Block label="Description" body={b.description} />}
        {b.dataInvolved && (
          <Block label="Data involved" body={b.dataInvolved} />
        )}
        {b.containmentActions && (
          <Block label="Containment actions" body={b.containmentActions} />
        )}
        {b.icoNotificationAssessment && (
          <Block
            label="ICO notification assessment"
            body={b.icoNotificationAssessment}
          />
        )}
        {b.individualNotificationAssessment && (
          <Block
            label="Individual notification assessment"
            body={b.individualNotificationAssessment}
          />
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
              {STATUSES.filter((s) => s !== b.status).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="ghost"
                  className="h-7 capitalize"
                  onClick={() => patch({ status: s }, "Status updated")}
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

function BreachForm({
  breach: b,
  onDone,
  onCancel,
}: {
  breach: Breach | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: b?.title ?? "",
    discoveredDate: b
      ? asDay(b.discoveredAt)
      : new Date().toISOString().slice(0, 10),
    occurredDate: b?.occurredAt ? asDay(b.occurredAt) : "",
    description: b?.description ?? "",
    dataInvolved: b?.dataInvolved ?? "",
    affectedPeopleEstimate: String(b?.affectedPeopleEstimate ?? 0),
    riskLevel: b?.riskLevel ?? "low",
    containmentActions: b?.containmentActions ?? "",
    icoNotificationAssessment: b?.icoNotificationAssessment ?? "",
    individualNotificationAssessment: b?.individualNotificationAssessment ?? "",
    status: b?.status ?? "open",
    owner: b?.owner ?? "",
    professionalSupportRequired: b?.professionalSupportRequired ?? false,
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title,
        discoveredDate: f.discoveredDate,
        occurredDate: f.occurredDate || null,
        description: f.description || null,
        dataInvolved: f.dataInvolved || null,
        affectedPeopleEstimate: Number(f.affectedPeopleEstimate) || 0,
        riskLevel: f.riskLevel,
        containmentActions: f.containmentActions || null,
        icoNotificationAssessment: f.icoNotificationAssessment || null,
        individualNotificationAssessment:
          f.individualNotificationAssessment || null,
        status: f.status,
        owner: f.owner || null,
        professionalSupportRequired: f.professionalSupportRequired,
      };
      const res = await fetch(
        b ? `/api/gdpr/breaches/${b.id}` : "/api/gdpr/breaches",
        {
          method: b ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(b ? "Breach saved" : "Breach logged");
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
        <SheetTitle>{b ? "Edit breach" : "Log data breach"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.title}
          onChange={(v) => set("title")(v)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Discovered"
            type="date"
            value={f.discoveredDate}
            onChange={(v) => set("discoveredDate")(v)}
            required
          />
          <TextField
            label="Occurred"
            type="date"
            value={f.occurredDate}
            onChange={(v) => set("occurredDate")(v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Risk level"
            value={f.riskLevel}
            onChange={(v) => set("riskLevel")(v)}
            options={RISKS}
          />
          <TextField
            label="People affected"
            type="number"
            value={f.affectedPeopleEstimate}
            onChange={(v) => set("affectedPeopleEstimate")(v)}
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
            value={f.owner}
            onChange={(v) => set("owner")(v)}
          />
        </div>
        <AreaField
          label="Description"
          value={f.description}
          onChange={(v) => set("description")(v)}
        />
        <AreaField
          label="Data involved"
          value={f.dataInvolved}
          onChange={(v) => set("dataInvolved")(v)}
        />
        <AreaField
          label="Containment actions"
          value={f.containmentActions}
          onChange={(v) => set("containmentActions")(v)}
        />
        <AreaField
          label="ICO notification assessment"
          value={f.icoNotificationAssessment}
          onChange={(v) => set("icoNotificationAssessment")(v)}
        />
        <AreaField
          label="Individual notification assessment"
          value={f.individualNotificationAssessment}
          onChange={(v) => set("individualNotificationAssessment")(v)}
        />
        <SwitchField
          label="Professional support recommended"
          checked={f.professionalSupportRequired}
          onChange={(v) => set("professionalSupportRequired")(v)}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : b ? "Save changes" : "Log breach"}
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
