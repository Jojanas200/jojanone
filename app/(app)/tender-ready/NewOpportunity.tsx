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

const PROCEDURES = [
  "open",
  "restricted",
  "framework",
  "direct_award",
  "quotation",
  "other",
] as const;

export function NewOpportunity() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    title: "",
    authority: "",
    valuePounds: "",
    submissionDeadline: "",
    procedureType: "open",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title,
        procedureType: f.procedureType,
      };
      if (f.authority.trim()) payload.authority = f.authority.trim();
      if (f.submissionDeadline)
        payload.submissionDeadline = f.submissionDeadline;
      const pounds = Number(f.valuePounds);
      if (Number.isFinite(pounds) && pounds > 0)
        payload.contractValue = Math.round(pounds * 100);

      const res = await fetch("/api/tender-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Opportunity added");
      setOpen(false);
      setF((p) => ({
        ...p,
        title: "",
        authority: "",
        valuePounds: "",
        submissionDeadline: "",
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
        <Button>New opportunity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tender opportunity</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={f.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Grounds maintenance framework"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="authority">Authority</Label>
              <Input
                id="authority"
                value={f.authority}
                onChange={(e) => set("authority")(e.target.value)}
                placeholder="Borough Council"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valuePounds">Value (£)</Label>
              <Input
                id="valuePounds"
                type="number"
                min={0}
                value={f.valuePounds}
                onChange={(e) => set("valuePounds")(e.target.value)}
                placeholder="120000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="submissionDeadline">Submission deadline</Label>
              <Input
                id="submissionDeadline"
                type="date"
                value={f.submissionDeadline}
                onChange={(e) => set("submissionDeadline")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Procedure</Label>
              <Select
                value={f.procedureType}
                onValueChange={set("procedureType")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCEDURES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
