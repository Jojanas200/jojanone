"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = [
  "board_meeting",
  "written_resolution",
  "director_decision",
  "shareholder_decision",
  "meeting_minutes",
  "governance_review",
] as const;

export function NewRecord() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    recordType: "board_meeting",
    title: "",
    meetingDate: "",
    decision: "",
    decisionMaker: "",
    participants: "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        recordType: f.recordType,
        title: f.title,
      };
      if (f.meetingDate) payload.meetingDate = f.meetingDate;
      if (f.decision.trim()) payload.decision = f.decision.trim();
      if (f.decisionMaker.trim())
        payload.decisionMaker = f.decisionMaker.trim();
      if (f.participants.trim()) payload.participants = f.participants.trim();

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
      setF((p) => ({
        ...p,
        title: "",
        meetingDate: "",
        decision: "",
        decisionMaker: "",
        participants: "",
      }));
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New governance record</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={f.recordType} onValueChange={set("recordType")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingDate">Date</Label>
              <Input
                id="meetingDate"
                type="date"
                value={f.meetingDate}
                onChange={(e) => set("meetingDate")(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={f.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Approve office lease"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision">Decision</Label>
            <Input
              id="decision"
              value={f.decision}
              onChange={(e) => set("decision")(e.target.value)}
              placeholder="Lease approved on the terms tabled"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="decisionMaker">Decision maker</Label>
              <Input
                id="decisionMaker"
                value={f.decisionMaker}
                onChange={(e) => set("decisionMaker")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participants">Participants</Label>
              <Input
                id="participants"
                value={f.participants}
                onChange={(e) => set("participants")(e.target.value)}
              />
            </div>
          </div>
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
