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

const TYPES = ["employee", "contractor", "consultant", "intern"] as const;
const RTW = ["verified", "outstanding", "expired", "not_required"] as const;
const TRAINING = ["complete", "outstanding", "overdue"] as const;
const RISK = ["low", "medium", "high"] as const;

export function NewEmployee() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    fullName: "",
    jobTitle: "",
    department: "",
    employmentType: "employee",
    startDate: "",
    rightToWorkStatus: "outstanding",
    trainingStatus: "outstanding",
    riskLevel: "low",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: f.fullName,
        employmentType: f.employmentType,
        rightToWorkStatus: f.rightToWorkStatus,
        trainingStatus: f.trainingStatus,
        riskLevel: f.riskLevel,
      };
      if (f.jobTitle.trim()) payload.jobTitle = f.jobTitle.trim();
      if (f.department.trim()) payload.department = f.department.trim();
      if (f.startDate) payload.startDate = f.startDate;

      const res = await fetch("/api/hr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Employee added");
      setOpen(false);
      setF((p) => ({
        ...p,
        fullName: "",
        jobTitle: "",
        department: "",
        startDate: "",
      }));
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const sel = (label: string, key: keyof typeof f, opts: readonly string[]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={f[key]} onValueChange={set(key)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o} value={o}>
              {o.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              value={f.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
              placeholder="Jordan Blake"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input
                id="jobTitle"
                value={f.jobTitle}
                onChange={(e) => set("jobTitle")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={f.department}
                onChange={(e) => set("department")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {sel("Type", "employmentType", TYPES)}
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={f.startDate}
                onChange={(e) => set("startDate")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {sel("Right to work", "rightToWorkStatus", RTW)}
            {sel("Training", "trainingStatus", TRAINING)}
            {sel("Risk", "riskLevel", RISK)}
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
