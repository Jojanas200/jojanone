"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AreaField, SelectField, TextField } from "../_shared/board-bits";

const TYPES = [
  "board_meeting",
  "meeting_minutes",
  "director_decision",
  "shareholder_decision",
  "written_resolution",
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

const BLANK = {
  recordType: "board_meeting",
  title: "",
  description: "",
  status: "draft",
  meetingDate: "",
  decisionDate: "",
  reviewDate: "",
  owner: "",
  decisionMaker: "",
  participants: "",
  background: "",
  optionsConsidered: "",
  risksConsidered: "",
  decision: "",
  actions: "",
  notes: "",
};

export function NewRecord() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ ...BLANK });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  const isDirector = f.recordType === "director_decision";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        recordType: f.recordType,
        title: f.title.trim(),
        status: f.status,
      };
      const text = (k: keyof typeof f) => {
        const v = f[k].trim();
        if (v) payload[k] = v;
      };
      text("description");
      if (f.meetingDate) payload.meetingDate = f.meetingDate;
      if (f.decisionDate) payload.decisionDate = f.decisionDate;
      if (f.reviewDate) payload.reviewDate = f.reviewDate;
      text("owner");
      text("participants");
      text("decision");
      text("decisionMaker");
      text("actions");
      text("notes");
      if (isDirector) {
        text("background");
        text("optionsConsidered");
        text("risksConsidered");
      }

      const res = await fetch("/api/governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Record added");
      setOpen(false);
      setF({ ...BLANK });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New record</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New governance record</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Type"
              value={f.recordType}
              onChange={set("recordType")}
              options={TYPES}
            />
            <SelectField
              label="Status"
              value={f.status}
              onChange={set("status")}
              options={STATUSES}
            />
          </div>
          <TextField
            label="Title"
            value={f.title}
            onChange={set("title")}
            required
          />
          <AreaField
            label="Description"
            value={f.description}
            onChange={set("description")}
            rows={2}
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
            <TextField
              label="Review date"
              type="date"
              value={f.reviewDate}
              onChange={set("reviewDate")}
            />
            <TextField label="Owner" value={f.owner} onChange={set("owner")} />
          </div>
          <TextField
            label="Participants"
            value={f.participants}
            onChange={set("participants")}
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
                rows={2}
              />
              <AreaField
                label="Options considered"
                value={f.optionsConsidered}
                onChange={set("optionsConsidered")}
                rows={2}
              />
              <AreaField
                label="Risks considered"
                value={f.risksConsidered}
                onChange={set("risksConsidered")}
                rows={2}
              />
            </div>
          )}

          <AreaField
            label="Decision"
            value={f.decision}
            onChange={set("decision")}
            rows={2}
          />
          <TextField
            label="Decision maker"
            value={f.decisionMaker}
            onChange={set("decisionMaker")}
          />
          <AreaField
            label="Actions"
            value={f.actions}
            onChange={set("actions")}
            rows={2}
          />
          <AreaField label="Notes" value={f.notes} onChange={set("notes")} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
