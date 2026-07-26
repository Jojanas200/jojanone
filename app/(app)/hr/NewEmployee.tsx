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
import {
  AreaField,
  SelectField,
  SwitchField,
  TextField,
} from "../_shared/board-bits";

const TYPES = ["employee", "contractor", "consultant", "intern"];
const STATUSES = ["active", "probation", "notice", "archived"];
const RTW = ["verified", "outstanding", "expired", "not_required"];
const TRAINING = ["complete", "outstanding", "overdue"];
const CONTRACT = ["signed", "pending", "missing"];
const ACK = ["complete", "outstanding"];
const RISKS = ["low", "medium", "high"];

export function NewEmployee() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    fullName: "",
    jobTitle: "",
    department: "",
    employmentType: "employee",
    employmentStatus: "active",
    startDate: "",
    probationEndDate: "",
    contractStatus: "missing",
    rightToWorkStatus: "outstanding",
    rightToWorkExpiry: "",
    policyAcknowledgementStatus: "outstanding",
    trainingStatus: "outstanding",
    nextReviewDate: "",
    riskLevel: "low",
    emergencyContactRecorded: false,
    notes: "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: f.fullName,
        employmentType: f.employmentType,
        employmentStatus: f.employmentStatus,
        contractStatus: f.contractStatus,
        rightToWorkStatus: f.rightToWorkStatus,
        policyAcknowledgementStatus: f.policyAcknowledgementStatus,
        trainingStatus: f.trainingStatus,
        riskLevel: f.riskLevel,
        emergencyContactRecorded: f.emergencyContactRecorded,
      };
      if (f.jobTitle.trim()) payload.jobTitle = f.jobTitle.trim();
      if (f.department.trim()) payload.department = f.department.trim();
      if (f.startDate) payload.startDate = f.startDate;
      if (f.probationEndDate) payload.probationEndDate = f.probationEndDate;
      if (f.rightToWorkExpiry) payload.rightToWorkExpiry = f.rightToWorkExpiry;
      if (f.nextReviewDate) payload.nextReviewDate = f.nextReviewDate;
      if (f.notes.trim()) payload.notes = f.notes.trim();

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
        probationEndDate: "",
        rightToWorkExpiry: "",
        nextReviewDate: "",
        emergencyContactRecorded: false,
        notes: "",
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
        <Button>New employee</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Full name"
              value={f.fullName}
              onChange={(v) => set("fullName")(v)}
              required
            />
            <TextField
              label="Job title"
              value={f.jobTitle}
              onChange={(v) => set("jobTitle")(v)}
            />
            <TextField
              label="Department"
              value={f.department}
              onChange={(v) => set("department")(v)}
            />
            <SelectField
              label="Type"
              value={f.employmentType}
              onChange={(v) => set("employmentType")(v)}
              options={TYPES}
            />
            <SelectField
              label="Status"
              value={f.employmentStatus}
              onChange={(v) => set("employmentStatus")(v)}
              options={STATUSES}
            />
            <TextField
              label="Start date"
              type="date"
              value={f.startDate}
              onChange={(v) => set("startDate")(v)}
            />
            <TextField
              label="Probation ends"
              type="date"
              value={f.probationEndDate}
              onChange={(v) => set("probationEndDate")(v)}
            />
            <TextField
              label="Next review"
              type="date"
              value={f.nextReviewDate}
              onChange={(v) => set("nextReviewDate")(v)}
            />
            <SelectField
              label="Contract"
              value={f.contractStatus}
              onChange={(v) => set("contractStatus")(v)}
              options={CONTRACT}
            />
            <SelectField
              label="Right to work"
              value={f.rightToWorkStatus}
              onChange={(v) => set("rightToWorkStatus")(v)}
              options={RTW}
            />
            <TextField
              label="RTW expiry"
              type="date"
              value={f.rightToWorkExpiry}
              onChange={(v) => set("rightToWorkExpiry")(v)}
            />
            <SelectField
              label="Training"
              value={f.trainingStatus}
              onChange={(v) => set("trainingStatus")(v)}
              options={TRAINING}
            />
            <SelectField
              label="Handbook acknowledged"
              value={f.policyAcknowledgementStatus}
              onChange={(v) => set("policyAcknowledgementStatus")(v)}
              options={ACK}
            />
            <SelectField
              label="Risk level"
              value={f.riskLevel}
              onChange={(v) => set("riskLevel")(v)}
              options={RISKS}
            />
          </div>
          <SwitchField
            label="Emergency contact recorded"
            checked={f.emergencyContactRecorded}
            onChange={(v) => set("emergencyContactRecorded")(v)}
          />
          <AreaField
            label="Notes"
            value={f.notes}
            onChange={(v) => set("notes")(v)}
          />
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
