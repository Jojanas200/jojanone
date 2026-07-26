"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  SelectField,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import { RowActions } from "./RowActions";
import type { listTenderOpportunities } from "@/server/services/tender";

type Opportunity = Awaited<ReturnType<typeof listTenderOpportunities>>[number];

// Light projection passed to the requirements/responses boards for linking.
export type OppOption = { id: string; title: string };

// Light requirement projection for the printed opportunity summary.
export type ReqLite = {
  opportunityId: string | null;
  title: string;
  requirementType: string;
  mandatory: boolean;
  status: string;
};

const PROCEDURES = [
  "open",
  "restricted",
  "framework",
  "direct_award",
  "quotation",
  "other",
];
const STATUSES = [
  "identified",
  "assessing",
  "bid",
  "no_bid",
  "drafting",
  "review",
  "submitted",
  "won",
  "lost",
  "archived",
];

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  identified: "outline",
  assessing: "outline",
  bid: "secondary",
  drafting: "secondary",
  submitted: "secondary",
  won: "secondary",
  no_bid: "outline",
  lost: "destructive",
  archived: "outline",
};

const money = (minor: number, currency: string) =>
  minor
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(minor / 100)
    : "-";

export function OpportunitiesBoard({
  opportunities,
  canWrite,
  requirements = [],
}: {
  opportunities: Opportunity[];
  canWrite: boolean;
  requirements?: ReqLite[];
}) {
  const [active, setActive] = useState<Opportunity | null>(null);

  return (
    <>
      <Card className="overflow-hidden p-0">
        {opportunities.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No opportunities yet. Track tenders, deadlines and bid decisions in
            one place.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((o) => (
                  <TableRow
                    key={o.id}
                    onClick={() => setActive(o)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {o.title}
                      {o.reference && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {o.reference}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.authority || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {money(o.contractValue, o.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(o.submissionDeadline)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[o.status] ?? "outline"}>
                        {nice(o.status)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canWrite && <RowActions id={o.id} status={o.status} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <OpportunityDrawer
        opportunity={active}
        canWrite={canWrite}
        requirements={requirements}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function OpportunityDrawer({
  opportunity,
  canWrite,
  requirements,
  onClose,
}: {
  opportunity: Opportunity | null;
  canWrite: boolean;
  requirements: ReqLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const close = () => {
    setEditing(false);
    onClose();
  };
  return (
    <Sheet open={!!opportunity} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {opportunity &&
          (editing ? (
            <OpportunityEditForm
              opportunity={opportunity}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <OpportunityView
              key={opportunity.id}
              opportunity={opportunity}
              canWrite={canWrite}
              requirements={requirements}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function OpportunityView({
  opportunity: o,
  canWrite,
  requirements,
  onEdit,
  onChanged,
  onClosed,
}: {
  opportunity: Opportunity;
  canWrite: boolean;
  requirements: ReqLite[];
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Local mirror so checklist changes show without reopening the drawer.
  const [checklist, setChecklist] = useState(o.checklist);
  const [itemLabel, setItemLabel] = useState("");
  const [itemMandatory, setItemMandatory] = useState(true);

  const mandatory = checklist.filter((c) => c.mandatory);
  const mandatoryDone = mandatory.filter((c) => c.done).length;
  const readyToSubmit =
    mandatory.length > 0 && mandatoryDone === mandatory.length;

  async function addChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemLabel.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tender-ready/${o.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: itemLabel.trim(),
          mandatory: itemMandatory,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setChecklist(data.opportunity.checklist);
      setItemLabel("");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecklistItem(itemId: string, done: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tender-ready/${o.id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, done }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setChecklist(data.opportunity.checklist);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markReadyToSubmit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tender-ready/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "review" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Marked ready to submit (in review)");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function printOpportunity() {
    const blocks: PrintBlock[] = [
      {
        kind: "rows",
        rows: [
          ["Authority", o.authority || "-"],
          ["Reference", o.reference || "-"],
          ["Sector", o.sector || "-"],
          ["Location", o.location || "-"],
          ["Value", money(o.contractValue, o.currency)],
          ["Procedure", nice(o.procedureType)],
          ["Status", nice(o.status)],
          ["Published", fmtDate(o.publicationDate)],
          ["Clarifications by", fmtDate(o.clarificationDeadline)],
          ["Submission deadline", fmtDate(o.submissionDeadline)],
          ["Contract starts", fmtDate(o.contractStartDate)],
          ["Duration", o.contractDuration || "-"],
          ["Source", o.source || "-"],
          ["Owner", o.owner || "-"],
        ],
      },
    ];
    if (o.summary)
      blocks.push({ kind: "text", heading: "Summary", body: o.summary });
    if (o.eligibilityNotes)
      blocks.push({
        kind: "text",
        heading: "Eligibility notes",
        body: o.eligibilityNotes,
      });
    const linked = requirements.filter((r) => r.opportunityId === o.id);
    if (linked.length > 0)
      blocks.push({
        kind: "table",
        heading: "Requirements",
        columns: ["Requirement", "Type", "Mandatory", "Status"],
        rows: linked.map((r) => [
          r.title,
          r.requirementType,
          r.mandatory ? "Yes" : "No",
          nice(r.status),
        ]),
      });
    printDocument({
      title: o.title,
      meta: `Tender opportunity · ${o.authority || "Unknown authority"}`,
      blocks,
      disclaimer: "A summary of your own records, not the tender documents.",
    });
  }

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch("/api/tender-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${o.title} (copy)`,
          authority: o.authority,
          reference: o.reference,
          sector: o.sector,
          location: o.location,
          contractValue: o.contractValue,
          currency: o.currency,
          publicationDate: o.publicationDate,
          clarificationDeadline: o.clarificationDeadline,
          submissionDeadline: o.submissionDeadline,
          contractStartDate: o.contractStartDate,
          contractDuration: o.contractDuration,
          procedureType: o.procedureType,
          status: "identified",
          source: o.source,
          summary: o.summary,
          eligibilityNotes: o.eligibilityNotes,
          owner: o.owner,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Opportunity duplicated");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${o.title}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tender-ready/${o.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Opportunity deleted");
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
        <SheetTitle>{o.title}</SheetTitle>
        <SheetDescription className="capitalize">
          {nice(o.procedureType)} · {nice(o.status)}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printOpportunity}>
          Print
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Authority">{o.authority || "-"}</Field>
          <Field label="Reference">{o.reference || "-"}</Field>
          <Field label="Sector">{o.sector || "-"}</Field>
          <Field label="Location">{o.location || "-"}</Field>
          <Field label="Value">{money(o.contractValue, o.currency)}</Field>
          <Field label="Published">{fmtDate(o.publicationDate)}</Field>
          <Field label="Clarifications by">
            {fmtDate(o.clarificationDeadline)}
          </Field>
          <Field label="Submission deadline">
            {fmtDate(o.submissionDeadline)}
          </Field>
          <Field label="Contract starts">{fmtDate(o.contractStartDate)}</Field>
          <Field label="Duration">{o.contractDuration || "-"}</Field>
          <Field label="Source">{o.source || "-"}</Field>
          <Field label="Owner">{o.owner || "-"}</Field>
        </dl>
        {o.summary && <Block label="Summary" body={o.summary} />}
        {o.eligibilityNotes && (
          <Block label="Eligibility notes" body={o.eligibilityNotes} />
        )}

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Submission checklist
            </p>
            {mandatory.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {mandatoryDone}/{mandatory.length} mandatory done
              </span>
            )}
          </div>
          {checklist.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No checklist items yet. List what must be in the submission pack.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {checklist.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm ${
                        c.done
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {c.label}
                    </p>
                    {c.mandatory && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Mandatory
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => toggleChecklistItem(c.id, !c.done)}
                      disabled={busy}
                    >
                      {c.done ? "Undo" : "Done"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && (
            <>
              <form
                onSubmit={addChecklistItem}
                className="mt-3 flex flex-wrap items-center gap-2"
              >
                <Input
                  value={itemLabel}
                  onChange={(e) => setItemLabel(e.target.value)}
                  placeholder="Add a checklist item…"
                  className="h-8 min-w-40 flex-1 text-sm"
                  aria-label="Checklist item"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={itemMandatory}
                    onChange={(e) => setItemMandatory(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  Mandatory
                </label>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8"
                  disabled={busy || !itemLabel.trim()}
                >
                  Add
                </Button>
              </form>
              {checklist.length > 0 &&
                o.status !== "review" &&
                o.status !== "submitted" && (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={markReadyToSubmit}
                    disabled={busy || !readyToSubmit}
                    title={
                      readyToSubmit
                        ? undefined
                        : "Complete every mandatory item first"
                    }
                  >
                    Mark ready to submit
                  </Button>
                )}
            </>
          )}
        </div>

        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={duplicate}
              disabled={busy}
            >
              Duplicate
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
        )}
      </div>
    </>
  );
}

function OpportunityEditForm({
  opportunity: o,
  onDone,
  onCancel,
}: {
  opportunity: Opportunity;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: o.title,
    authority: o.authority ?? "",
    reference: o.reference ?? "",
    sector: o.sector ?? "",
    location: o.location ?? "",
    value: o.contractValue ? String(o.contractValue / 100) : "",
    publicationDate: o.publicationDate ?? "",
    clarificationDeadline: o.clarificationDeadline ?? "",
    submissionDeadline: o.submissionDeadline ?? "",
    contractStartDate: o.contractStartDate ?? "",
    contractDuration: o.contractDuration ?? "",
    procedureType: o.procedureType,
    status: o.status,
    source: o.source ?? "",
    owner: o.owner ?? "",
    summary: o.summary ?? "",
    eligibilityNotes: o.eligibilityNotes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const pounds = f.value ? Number(f.value) : 0;
      const res = await fetch(`/api/tender-ready/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          authority: f.authority || null,
          reference: f.reference || null,
          sector: f.sector || null,
          location: f.location || null,
          contractValue:
            Number.isFinite(pounds) && pounds > 0
              ? Math.round(pounds * 100)
              : 0,
          publicationDate: f.publicationDate || null,
          clarificationDeadline: f.clarificationDeadline || null,
          submissionDeadline: f.submissionDeadline || null,
          contractStartDate: f.contractStartDate || null,
          contractDuration: f.contractDuration || null,
          procedureType: f.procedureType,
          status: f.status,
          source: f.source || null,
          owner: f.owner || null,
          summary: f.summary || null,
          eligibilityNotes: f.eligibilityNotes || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Opportunity saved");
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
        <SheetTitle>Edit opportunity</SheetTitle>
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
            label="Authority"
            value={f.authority}
            onChange={set("authority")}
          />
          <TextField
            label="Reference"
            value={f.reference}
            onChange={set("reference")}
          />
          <TextField label="Sector" value={f.sector} onChange={set("sector")} />
          <TextField
            label="Location"
            value={f.location}
            onChange={set("location")}
          />
          <TextField
            label="Value (£)"
            type="number"
            value={f.value}
            onChange={set("value")}
          />
          <TextField
            label="Duration"
            value={f.contractDuration}
            onChange={set("contractDuration")}
          />
          <TextField
            label="Published"
            type="date"
            value={f.publicationDate}
            onChange={set("publicationDate")}
          />
          <TextField
            label="Clarifications by"
            type="date"
            value={f.clarificationDeadline}
            onChange={set("clarificationDeadline")}
          />
          <TextField
            label="Submission deadline"
            type="date"
            value={f.submissionDeadline}
            onChange={set("submissionDeadline")}
          />
          <TextField
            label="Contract starts"
            type="date"
            value={f.contractStartDate}
            onChange={set("contractStartDate")}
          />
          <SelectField
            label="Procedure"
            value={f.procedureType}
            onChange={set("procedureType")}
            options={PROCEDURES}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
          <TextField label="Source" value={f.source} onChange={set("source")} />
          <TextField label="Owner" value={f.owner} onChange={set("owner")} />
        </div>
        <AreaField
          label="Summary"
          value={f.summary}
          onChange={set("summary")}
        />
        <AreaField
          label="Eligibility notes"
          value={f.eligibilityNotes}
          onChange={set("eligibilityNotes")}
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
