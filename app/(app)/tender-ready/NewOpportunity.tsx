"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const BLANK = {
  title: "",
  authority: "",
  reference: "",
  sector: "",
  location: "",
  valuePounds: "",
  publicationDate: "",
  clarificationDeadline: "",
  submissionDeadline: "",
  contractStartDate: "",
  contractDuration: "",
  procedureType: "open",
  source: "",
  owner: "",
  summary: "",
  eligibilityNotes: "",
};

export function NewOpportunity() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ ...BLANK });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title.trim(),
        procedureType: f.procedureType,
      };
      const text = (k: keyof typeof f) => {
        const v = f[k].trim();
        if (v) payload[k] = v;
      };
      text("authority");
      text("reference");
      text("sector");
      text("location");
      text("contractDuration");
      text("source");
      text("owner");
      text("summary");
      text("eligibilityNotes");
      if (f.publicationDate) payload.publicationDate = f.publicationDate;
      if (f.clarificationDeadline)
        payload.clarificationDeadline = f.clarificationDeadline;
      if (f.submissionDeadline)
        payload.submissionDeadline = f.submissionDeadline;
      if (f.contractStartDate) payload.contractStartDate = f.contractStartDate;
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
        <Button>New opportunity</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
            <LabeledInput
              id="authority"
              label="Authority"
              value={f.authority}
              onChange={set("authority")}
              placeholder="Borough Council"
            />
            <LabeledInput
              id="reference"
              label="Reference"
              value={f.reference}
              onChange={set("reference")}
              placeholder="CF-2026-014"
            />
            <LabeledInput
              id="sector"
              label="Sector"
              value={f.sector}
              onChange={set("sector")}
            />
            <LabeledInput
              id="location"
              label="Location"
              value={f.location}
              onChange={set("location")}
            />
            <LabeledInput
              id="valuePounds"
              label="Value (£)"
              type="number"
              value={f.valuePounds}
              onChange={set("valuePounds")}
              placeholder="120000"
            />
            <LabeledInput
              id="contractDuration"
              label="Duration"
              value={f.contractDuration}
              onChange={set("contractDuration")}
              placeholder="3 years + 1"
            />
            <LabeledInput
              id="publicationDate"
              label="Published"
              type="date"
              value={f.publicationDate}
              onChange={set("publicationDate")}
            />
            <LabeledInput
              id="clarificationDeadline"
              label="Clarifications by"
              type="date"
              value={f.clarificationDeadline}
              onChange={set("clarificationDeadline")}
            />
            <LabeledInput
              id="submissionDeadline"
              label="Submission deadline"
              type="date"
              value={f.submissionDeadline}
              onChange={set("submissionDeadline")}
            />
            <LabeledInput
              id="contractStartDate"
              label="Contract starts"
              type="date"
              value={f.contractStartDate}
              onChange={set("contractStartDate")}
            />
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
            <LabeledInput
              id="source"
              label="Source"
              value={f.source}
              onChange={set("source")}
              placeholder="Find a Tender / Contracts Finder"
            />
          </div>
          <LabeledInput
            id="owner"
            label="Owner"
            value={f.owner}
            onChange={set("owner")}
          />
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={2}
              value={f.summary}
              onChange={(e) => set("summary")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eligibilityNotes">Eligibility notes</Label>
            <Textarea
              id="eligibilityNotes"
              rows={2}
              value={f.eligibilityNotes}
              onChange={(e) => set("eligibilityNotes")(e.target.value)}
              placeholder="Accreditations, insurance levels, financial standing…"
            />
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

function LabeledInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
