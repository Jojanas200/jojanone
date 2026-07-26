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
  TextField,
} from "../_shared/board-bits";
import { nice } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import type { OppOption } from "./OpportunitiesBoard";
import type { listTenderResponses } from "@/server/services/tender-readiness";

type Resp = Awaited<ReturnType<typeof listTenderResponses>>[number];

const STATUSES = ["draft", "in_review", "final"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  draft: "outline",
  in_review: "warning",
  final: "success",
};

const wordCount = (s: string | null) =>
  s ? s.trim().split(/\s+/).filter(Boolean).length : 0;

export function TenderResponsesBoard({
  responses,
  canWrite,
  opportunities = [],
}: {
  responses: Resp[];
  canWrite: boolean;
  opportunities?: OppOption[];
}) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Resp | "new" | null>(null);
  const oppTitle = useMemo(
    () => new Map(opportunities.map((o) => [o.id, o.title])),
    [opportunities],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return responses.filter((r) => {
      if (statusF !== "all" && r.status !== statusF) return false;
      if (
        q &&
        !(r.sectionTitle ?? "").toLowerCase().includes(q) &&
        !(r.question ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [responses, search, statusF]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Draft, review and finalise your tender answers.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            New response
          </Button>
        )}
      </div>

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search sections or questions…"
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
        {responses.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No responses drafted yet. Start writing your tender answers here.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No responses match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Words</TableHead>
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
                      {r.sectionTitle || r.question || "Untitled"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(r.opportunityId && oppTitle.get(r.opportunityId)) ||
                        "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {wordCount(r.responseText)}
                      {r.wordLimit ? ` / ${r.wordLimit}` : ""}
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

      <RespDrawer
        item={active}
        canWrite={canWrite}
        opportunities={opportunities}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function RespDrawer({
  item,
  canWrite,
  opportunities,
  onClose,
}: {
  item: Resp | "new" | null;
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
            <RespForm
              resp={creating ? null : (item as Resp)}
              opportunities={opportunities}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <RespView
              resp={item as Resp}
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

function RespView({
  resp: r,
  canWrite,
  opportunities,
  onEdit,
  onChanged,
  onClosed,
}: {
  resp: Resp;
  canWrite: boolean;
  opportunities: OppOption[];
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const count = wordCount(r.responseText);
  const over = r.wordLimit > 0 && count > r.wordLimit;
  const oppName = r.opportunityId
    ? opportunities.find((o) => o.id === r.opportunityId)?.title
    : undefined;

  async function newVersion() {
    setBusy(true);
    try {
      const res = await fetch("/api/tender/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: r.opportunityId,
          version: r.version + 1,
          sectionTitle: r.sectionTitle,
          question: r.question,
          wordLimit: r.wordLimit,
          responseText: r.responseText,
          status: "draft",
          owner: r.owner,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Version ${r.version + 1} drafted`);
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this response?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tender/responses/${r.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Response deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function printResponse() {
    const blocks: PrintBlock[] = [
      {
        kind: "rows",
        rows: [
          ["Opportunity", oppName ?? "-"],
          ["Status", nice(r.status)],
          ["Words", `${count}${r.wordLimit ? ` / ${r.wordLimit}` : ""}`],
          ["Owner", r.owner || "-"],
        ],
      },
    ];
    if (r.question)
      blocks.push({ kind: "text", heading: "Question", body: r.question });
    if (r.responseText)
      blocks.push({ kind: "text", heading: "Answer", body: r.responseText });
    if (r.reviewNotes)
      blocks.push({
        kind: "text",
        heading: "Review notes",
        body: r.reviewNotes,
      });
    printDocument({
      title: r.sectionTitle || r.question || "Tender response",
      meta: `Tender response · ${nice(r.status)}`,
      blocks,
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{r.sectionTitle || r.question || "Response"}</SheetTitle>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printResponse}>
          Print
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Opportunity">{oppName ?? "-"}</Field>
          <Field label="Version">v{r.version}</Field>
          <Field label="Status">
            <Badge variant={statusVariant[r.status] ?? "outline"}>
              {nice(r.status)}
            </Badge>
          </Field>
          <Field label="Words">
            <span className={over ? "font-medium text-destructive" : ""}>
              {count}
              {r.wordLimit ? ` / ${r.wordLimit}` : ""}
            </span>
          </Field>
          <Field label="Owner">{r.owner || "-"}</Field>
        </dl>
        {r.question && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Question
            </p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {r.question}
            </p>
          </div>
        )}
        {r.responseText && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Answer</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {r.responseText}
            </p>
          </div>
        )}
        {r.reviewNotes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Review notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {r.reviewNotes}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {r.responseText && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(r.responseText ?? "");
                toast.success("Answer copied");
              }}
            >
              Copy answer
            </Button>
          )}
          {canWrite && (
            <>
              <Button size="sm" onClick={onEdit} disabled={busy}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={newVersion}
                disabled={busy}
              >
                New version (v{r.version + 1})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={remove}
                disabled={busy}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function RespForm({
  resp: r,
  opportunities,
  onDone,
  onCancel,
}: {
  resp: Resp | null;
  opportunities: OppOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    opportunityId: r?.opportunityId ?? "none",
    sectionTitle: r?.sectionTitle ?? "",
    question: r?.question ?? "",
    wordLimit: String(r?.wordLimit ?? 0),
    responseText: r?.responseText ?? "",
    status: r?.status ?? "draft",
    reviewNotes: r?.reviewNotes ?? "",
    owner: r?.owner ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));
  const count = wordCount(f.responseText);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        opportunityId: f.opportunityId === "none" ? null : f.opportunityId,
        sectionTitle: f.sectionTitle || null,
        question: f.question || null,
        wordLimit: Number(f.wordLimit) || 0,
        responseText: f.responseText || null,
        status: f.status,
        reviewNotes: f.reviewNotes || null,
        owner: f.owner || null,
      };
      const res = await fetch(
        r ? `/api/tender/responses/${r.id}` : "/api/tender/responses",
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
      toast.success(r ? "Response saved" : "Response created");
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
        <SheetTitle>{r ? "Edit response" : "New response"}</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Section title"
          value={f.sectionTitle}
          onChange={set("sectionTitle")}
        />
        {opportunities.length > 0 && (
          <SelectField
            label="Opportunity"
            value={f.opportunityId}
            onChange={set("opportunityId")}
            options={[
              { value: "none", label: "Not linked" },
              ...opportunities.map((o) => ({ value: o.id, label: o.title })),
            ]}
          />
        )}
        <AreaField
          label="Question"
          value={f.question}
          onChange={set("question")}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
          <TextField
            label="Word limit"
            type="number"
            value={f.wordLimit}
            onChange={set("wordLimit")}
          />
        </div>
        <div>
          <AreaField
            label={`Answer (${count} words${f.wordLimit && Number(f.wordLimit) > 0 ? ` / ${f.wordLimit}` : ""})`}
            value={f.responseText}
            onChange={set("responseText")}
            rows={8}
          />
        </div>
        <TextField label="Owner" value={f.owner} onChange={set("owner")} />
        <AreaField
          label="Review notes"
          value={f.reviewNotes}
          onChange={set("reviewNotes")}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : r ? "Save changes" : "Create response"}
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
