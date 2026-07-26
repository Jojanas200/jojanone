"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Pager,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import type { listRisks } from "@/server/services/risk";

type Risk = Awaited<ReturnType<typeof listRisks>>[number];

const CATEGORIES = [
  "compliance",
  "contracts",
  "data_protection",
  "cyber",
  "people",
  "financial",
  "operational",
  "supplier",
  "strategic",
];
const STATUSES = ["open", "accepted", "closed"];
const RESPONSES = ["avoid", "reduce", "transfer", "accept", "monitor"];
const EFFECTIVENESS = ["strong", "adequate", "weak", "none"];
const SCORES = ["1", "2", "3", "4", "5"];

const ratingVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  low: "success",
  medium: "warning",
  high: "destructive",
  critical: "destructive",
};
const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  open: "destructive",
  accepted: "warning",
  closed: "success",
};

const bandClass = (score: number) =>
  score <= 4
    ? "bg-emerald-500/15"
    : score <= 9
      ? "bg-amber-500/20"
      : score <= 14
        ? "bg-orange-500/30"
        : "bg-red-500/30";

function RatingBadge({
  rating,
  score,
}: {
  rating: string | null;
  score: number | null;
}) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant={ratingVariant[rating] ?? "outline"}>
      {rating}
      {score != null ? ` · ${score}` : ""}
    </Badge>
  );
}

export function RiskBoard({
  risks,
  canWrite,
}: {
  risks: Risk[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [categoryF, setCategoryF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Risk | null>(null);

  const tiles = useMemo(
    () => [
      {
        label: "Open",
        value: String(risks.filter((r) => r.status === "open").length),
      },
      {
        label: "High inherent",
        value: String(
          risks.filter(
            (r) =>
              r.inherentRating === "high" || r.inherentRating === "critical",
          ).length,
        ),
      },
      {
        label: "High residual",
        value: String(
          risks.filter(
            (r) =>
              r.residualRating === "high" || r.residualRating === "critical",
          ).length,
        ),
      },
      {
        label: "Reviews overdue",
        value: String(
          risks.filter(
            (r) =>
              r.status === "open" &&
              r.reviewDate &&
              new Date(r.reviewDate).getTime() < Date.now(),
          ).length,
        ),
      },
      {
        label: "Mitigations overdue",
        value: String(
          risks.reduce(
            (n, r) =>
              n +
              (r.status === "open"
                ? r.mitigations.filter(
                    (m) =>
                      !m.completedAt &&
                      m.dueDate &&
                      new Date(m.dueDate).getTime() < Date.now(),
                  ).length
                : 0),
            0,
          ),
        ),
      },
      {
        label: "Accepted",
        value: String(risks.filter((r) => r.status === "accepted").length),
      },
    ],
    [risks],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return risks.filter((r) => {
      if (categoryF !== "all" && r.riskCategory !== categoryF) return false;
      if (statusF !== "all" && r.status !== statusF) return false;
      if (
        q &&
        !r.riskTitle.toLowerCase().includes(q) &&
        !(r.riskOwner ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [risks, search, categoryF, statusF]);

  const filtersActive = !!search || categoryF !== "all" || statusF !== "all";

  const openMatrixCount = risks.filter(
    (r) => r.status === "open" || r.status === "accepted",
  ).length;

  // Client-side pagination keeps the register readable as records grow.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const paged = shown.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <StatTiles tiles={tiles} />

      <Tabs defaultValue="register">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="register">
              Register ({risks.length})
            </TabsTrigger>
            <TabsTrigger value="matrix">
              Matrix{openMatrixCount > 0 ? ` (${openMatrixCount})` : ""}
            </TabsTrigger>
          </TabsList>
          <ScoringExplainer />
        </div>

        <TabsContent value="matrix" className="mt-4">
          <RiskMatrix risks={risks} onPick={setActive} />
        </TabsContent>

        <TabsContent value="register" className="mt-4">
          <div className="mb-4 space-y-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by risk or owner…"
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
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCategoryF("all");
                    setStatusF("all");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            {risks.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No risks yet. Add your first risk to build a live register with
                inherent and residual scoring.
              </div>
            ) : shown.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No risks match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Inherent</TableHead>
                      <TableHead>Residual</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((r) => (
                      <TableRow
                        key={r.id}
                        onClick={() => setActive(r)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium text-foreground">
                          {r.riskTitle}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {nice(r.riskCategory)}
                        </TableCell>
                        <TableCell>
                          <RatingBadge
                            rating={r.inherentRating}
                            score={r.inherentScore}
                          />
                        </TableCell>
                        <TableCell>
                          <RatingBadge
                            rating={r.residualRating}
                            score={r.residualScore}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.riskOwner || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmtDate(r.reviewDate)}
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
          <Pager
            page={cur}
            pageCount={pageCount}
            total={shown.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </TabsContent>
      </Tabs>

      <RiskDrawer
        risk={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function RiskMatrix({
  risks,
  onPick,
}: {
  risks: Risk[];
  onPick: (r: Risk) => void;
}) {
  const [mode, setMode] = useState<"inherent" | "residual">("residual");
  // Live risks (open or accepted) sit on the matrix; closed risks fall off it.
  const live = risks.filter(
    (r) => r.status === "open" || r.status === "accepted",
  );
  const cell = (likelihood: number, impact: number) =>
    live.filter((r) =>
      mode === "inherent"
        ? r.likelihood === likelihood && r.impact === impact
        : r.residualLikelihood === likelihood && r.residualImpact === impact,
    );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Risk matrix</p>
          <p className="text-xs text-muted-foreground">
            {mode === "residual" ? "Residual" : "Inherent"} likelihood × impact
            for open and accepted risks. Click a cell to open the risk.
          </p>
        </div>
        <div className="flex gap-1">
          {(["inherent", "residual"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "outline"}
              className="h-7 capitalize"
              onClick={() => setMode(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>
      {live.length === 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No open or accepted risks to plot yet. Add a risk to populate the
          matrix.
        </p>
      )}
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="[writing-mode:vertical-rl] rotate-180">Impact</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {[5, 4, 3, 2, 1].map((impact) =>
              [1, 2, 3, 4, 5].map((likelihood) => {
                const items = cell(likelihood, impact);
                return (
                  <button
                    key={`${likelihood}-${impact}`}
                    type="button"
                    disabled={items.length === 0}
                    onClick={() => items[0] && onPick(items[0])}
                    className={`flex aspect-square items-center justify-center rounded-md text-sm font-semibold ${bandClass(
                      likelihood * impact,
                    )} ${items.length ? "text-foreground hover:ring-2 hover:ring-ring" : "text-transparent"}`}
                    title={`Likelihood ${likelihood} × Impact ${impact}`}
                  >
                    {items.length || ""}
                  </button>
                );
              }),
            )}
          </div>
          <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Likelihood
          </p>
        </div>
      </div>
    </Card>
  );
}

function RiskDrawer({
  risk,
  canWrite,
  onClose,
}: {
  risk: Risk | null;
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
    <Sheet open={!!risk} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {risk &&
          (editing ? (
            <RiskEditForm
              risk={risk}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <RiskView
              key={risk.id}
              risk={risk}
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

function RiskView({
  risk: r,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  risk: Risk;
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Local mirror so added/completed mitigations show without reopening.
  const [mits, setMits] = useState(r.mitigations);
  const [mitLabel, setMitLabel] = useState("");
  const [mitDue, setMitDue] = useState("");

  async function addMitigation(e: React.FormEvent) {
    e.preventDefault();
    if (!mitLabel.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/risk/${r.id}/mitigations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: mitLabel.trim(),
          dueDate: mitDue || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setMits(data.risk.mitigations);
      setMitLabel("");
      setMitDue("");
      toast.success("Mitigation added");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMitigation(mitigationId: string, done: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/risk/${r.id}/mitigations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mitigationId, done }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setMits(data.risk.mitigations);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function printRisk() {
    const blocks: PrintBlock[] = [
      {
        kind: "rows",
        rows: [
          ["Category", nice(r.riskCategory)],
          ["Status", r.status],
          [
            "Inherent",
            `${r.inherentRating ?? "-"}${r.inherentScore != null ? ` (${r.inherentScore})` : ""}`,
          ],
          [
            "Residual",
            `${r.residualRating ?? "-"}${r.residualScore != null ? ` (${r.residualScore})` : ""}`,
          ],
          [
            "Likelihood × impact",
            `${r.likelihood ?? "-"} × ${r.impact ?? "-"} (residual ${r.residualLikelihood ?? "-"} × ${r.residualImpact ?? "-"})`,
          ],
          ["Control effectiveness", nice(r.controlEffectiveness ?? "none")],
          ["Response", r.response],
          ["Owner", r.riskOwner || "-"],
          ["Review date", fmtDate(r.reviewDate)],
        ],
      },
    ];
    if (r.description)
      blocks.push({
        kind: "text",
        heading: "Description",
        body: r.description,
      });
    if (r.cause) blocks.push({ kind: "text", heading: "Cause", body: r.cause });
    if (r.consequence)
      blocks.push({
        kind: "text",
        heading: "Consequence",
        body: r.consequence,
      });
    if (r.controls)
      blocks.push({ kind: "text", heading: "Controls", body: r.controls });
    if (mits.length > 0)
      blocks.push({
        kind: "list",
        heading: "Mitigations",
        items: mits.map(
          (m) =>
            `${m.label} - ${
              m.completedAt
                ? `done ${fmtDate(m.completedAt.slice(0, 10))}`
                : m.dueDate
                  ? `due ${fmtDate(m.dueDate)}`
                  : "no due date"
            }`,
        ),
      });
    printDocument({
      title: r.riskTitle,
      meta: `Risk register · ${nice(r.riskCategory)} · ${r.status}`,
      blocks,
      disclaimer: "Guidance to support your own judgement, not advice.",
    });
  }

  async function setStatus(status: string, needReason: boolean) {
    let reason: string | null = null;
    if (needReason) {
      reason = window.prompt(`Reason for marking ${status}?`) ?? "";
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/risk/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Risk updated");
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${r.riskTitle}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/risk/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Risk deleted");
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
        <SheetTitle>{r.riskTitle}</SheetTitle>
        <SheetDescription className="capitalize">
          {nice(r.riskCategory)} · {r.status}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printRisk}>
          Print
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Inherent">
            <RatingBadge rating={r.inherentRating} score={r.inherentScore} />
          </Field>
          <Field label="Residual">
            <RatingBadge rating={r.residualRating} score={r.residualScore} />
          </Field>
          <Field label="Likelihood × Impact">
            {r.likelihood ?? "-"} × {r.impact ?? "-"} (residual{" "}
            {r.residualLikelihood ?? "-"} × {r.residualImpact ?? "-"})
          </Field>
          <Field label="Control effectiveness">
            <span className="capitalize">
              {nice(r.controlEffectiveness ?? "none")}
            </span>
          </Field>
          <Field label="Response">
            <span className="capitalize">{r.response}</span>
          </Field>
          <Field label="Owner">{r.riskOwner || "-"}</Field>
          <Field label="Review">{fmtDate(r.reviewDate)}</Field>
        </dl>
        {r.description && <Block label="Description" body={r.description} />}
        {r.cause && <Block label="Cause" body={r.cause} />}
        {r.consequence && <Block label="Consequence" body={r.consequence} />}
        {r.controls && <Block label="Controls" body={r.controls} />}
        {r.acceptanceReason && (
          <Block label="Acceptance reason" body={r.acceptanceReason} />
        )}
        {r.closureReason && (
          <Block label="Closure reason" body={r.closureReason} />
        )}

        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mitigations
          </p>
          {mits.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No mitigation actions yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {mits.map((m) => {
                const overdue =
                  !m.completedAt &&
                  m.dueDate &&
                  new Date(m.dueDate).getTime() < Date.now();
                return (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-2.5"
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-sm ${
                          m.completedAt
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {m.label}
                      </p>
                      <p
                        className={`mt-0.5 text-xs ${
                          overdue
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {m.completedAt
                          ? `Done ${fmtDate(m.completedAt.slice(0, 10))}`
                          : m.dueDate
                            ? `Due ${fmtDate(m.dueDate)}${overdue ? " (overdue)" : ""}`
                            : "No due date"}
                      </p>
                    </div>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => toggleMitigation(m.id, !m.completedAt)}
                        disabled={busy}
                      >
                        {m.completedAt ? "Reopen" : "Complete"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {canWrite && (
            <form
              onSubmit={addMitigation}
              className="mt-3 flex flex-wrap gap-2"
            >
              <Input
                value={mitLabel}
                onChange={(e) => setMitLabel(e.target.value)}
                placeholder="Add a mitigation action…"
                className="h-8 min-w-40 flex-1 text-sm"
                aria-label="Mitigation action"
              />
              <Input
                type="date"
                value={mitDue}
                onChange={(e) => setMitDue(e.target.value)}
                className="h-8 w-36 text-sm"
                aria-label="Mitigation due date"
              />
              <Button
                type="submit"
                size="sm"
                className="h-8"
                disabled={busy || !mitLabel.trim()}
              >
                Add
              </Button>
            </form>
          )}
        </div>

        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            {r.status !== "accepted" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("accepted", true)}
                disabled={busy}
              >
                Accept
              </Button>
            )}
            {r.status !== "closed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("closed", true)}
                disabled={busy}
              >
                Close
              </Button>
            )}
            {r.status !== "open" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("open", false)}
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
        )}
      </div>
    </>
  );
}

function RiskEditForm({
  risk: r,
  onDone,
  onCancel,
}: {
  risk: Risk;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    riskTitle: r.riskTitle,
    riskCategory: r.riskCategory,
    description: r.description ?? "",
    cause: r.cause ?? "",
    consequence: r.consequence ?? "",
    likelihood: String(r.likelihood ?? 3),
    impact: String(r.impact ?? 3),
    controls: r.controls ?? "",
    controlEffectiveness: r.controlEffectiveness ?? "none",
    residualLikelihood: String(r.residualLikelihood ?? 3),
    residualImpact: String(r.residualImpact ?? 3),
    riskOwner: r.riskOwner ?? "",
    response: r.response,
    reviewDate: r.reviewDate ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/risk/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskTitle: f.riskTitle,
          riskCategory: f.riskCategory,
          description: f.description || null,
          cause: f.cause || null,
          consequence: f.consequence || null,
          likelihood: Number(f.likelihood),
          impact: Number(f.impact),
          controls: f.controls || null,
          controlEffectiveness: f.controlEffectiveness,
          residualLikelihood: Number(f.residualLikelihood),
          residualImpact: Number(f.residualImpact),
          riskOwner: f.riskOwner || null,
          response: f.response,
          reviewDate: f.reviewDate || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Risk saved");
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
        <SheetTitle>Edit risk</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Title"
          value={f.riskTitle}
          onChange={set("riskTitle")}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            value={f.riskCategory}
            onChange={set("riskCategory")}
            options={CATEGORIES}
          />
          <SelectField
            label="Response"
            value={f.response}
            onChange={set("response")}
            options={RESPONSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Likelihood (inherent)"
            value={f.likelihood}
            onChange={set("likelihood")}
            options={SCORES}
          />
          <SelectField
            label="Impact (inherent)"
            value={f.impact}
            onChange={set("impact")}
            options={SCORES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Likelihood (residual)"
            value={f.residualLikelihood}
            onChange={set("residualLikelihood")}
            options={SCORES}
          />
          <SelectField
            label="Impact (residual)"
            value={f.residualImpact}
            onChange={set("residualImpact")}
            options={SCORES}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Control effectiveness"
            value={f.controlEffectiveness}
            onChange={set("controlEffectiveness")}
            options={EFFECTIVENESS}
          />
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={set("reviewDate")}
          />
        </div>
        <TextField
          label="Owner"
          value={f.riskOwner}
          onChange={set("riskOwner")}
        />
        <AreaField
          label="Description"
          value={f.description}
          onChange={set("description")}
        />
        <AreaField label="Cause" value={f.cause} onChange={set("cause")} />
        <AreaField
          label="Consequence"
          value={f.consequence}
          onChange={set("consequence")}
        />
        <AreaField
          label="Controls"
          value={f.controls}
          onChange={set("controls")}
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

// Plain-English explanation of the 5x5 scoring model, mirroring the service's
// rating bands exactly (>=20 critical, >=12 high, >=6 medium, else low).
function ScoringExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        How is this calculated?
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How risk scores are calculated</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-foreground">
            <p>
              Each risk is scored on a 5×5 matrix:{" "}
              <span className="font-medium">likelihood × impact</span> (each
              1–5), giving a score from 1 to 25.
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <Badge variant="success">Low</Badge> score 1–5
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="warning">Medium</Badge> score 6–11
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="destructive">High</Badge> score 12–19
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="destructive">Critical</Badge> score 20–25
              </li>
            </ul>
            <p>
              <span className="font-medium">Inherent</span> is the raw risk
              before controls; <span className="font-medium">residual</span> is
              re-scored with your controls in place. The register sorts by
              residual score, and the matrix plots residual likelihood × impact.
            </p>
            <p className="text-xs text-muted-foreground">
              Scoring is a structured judgement to aid prioritisation, not a
              precise measurement.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
