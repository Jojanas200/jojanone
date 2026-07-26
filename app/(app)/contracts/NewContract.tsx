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

const TYPES = [
  "customer",
  "supplier",
  "employment",
  "contractor",
  "software",
  "office",
  "dpa",
  "insurance",
  "nda",
  "other",
] as const;
const STATUSES = [
  "draft",
  "active",
  "pending_signature",
  "expired",
  "archived",
] as const;
const RISKS = ["low", "medium", "high"] as const;
const CURRENCIES = ["GBP", "EUR", "USD"] as const;

export type EntityOption = { id: string; name: string };

const BLANK = {
  title: "",
  counterparty: "",
  contractType: "customer",
  status: "draft",
  riskLevel: "low",
  currency: "GBP",
  value: "",
  startDate: "",
  endDate: "",
  renewalDate: "",
  noticePeriodDays: "",
  owner: "",
  entityId: "none",
  nextAction: "",
  nextActionDate: "",
  keyTerms: "",
  obligations: "",
  notes: "",
};

export function NewContract({ entities = [] }: { entities?: EntityOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ ...BLANK });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.startDate && f.endDate && f.endDate < f.startDate) {
      toast.error("End date must be after the start date.");
      return;
    }
    const pounds = f.value ? Number(f.value) : 0;
    if (!Number.isFinite(pounds) || pounds < 0) {
      toast.error("Value must be zero or more.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title.trim(),
        counterparty: f.counterparty.trim(),
        contractType: f.contractType,
        status: f.status,
        riskLevel: f.riskLevel,
        currency: f.currency,
        valueMinor: Math.round(pounds * 100),
      };
      if (f.startDate) payload.startDate = f.startDate;
      if (f.endDate) payload.endDate = f.endDate;
      if (f.renewalDate) payload.renewalDate = f.renewalDate;
      if (f.noticePeriodDays)
        payload.noticePeriodDays = parseInt(f.noticePeriodDays, 10);
      if (f.owner.trim()) payload.owner = f.owner.trim();
      if (f.entityId !== "none") payload.entityId = f.entityId;
      if (f.nextAction.trim()) payload.nextAction = f.nextAction.trim();
      if (f.nextActionDate) payload.nextActionDate = f.nextActionDate;
      if (f.keyTerms.trim()) payload.keyTerms = f.keyTerms.trim();
      if (f.obligations.trim()) payload.obligations = f.obligations.trim();
      if (f.notes.trim()) payload.notes = f.notes.trim();

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      }
      toast.success("Contract added");
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
        <Button>New contract</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={f.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Office lease"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="counterparty">Counterparty</Label>
              <Input
                id="counterparty"
                value={f.counterparty}
                onChange={(e) => set("counterparty")(e.target.value)}
              />
            </div>
            <SelectField
              label="Type"
              value={f.contractType}
              onChange={set("contractType")}
              options={[...TYPES]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Status"
              value={f.status}
              onChange={set("status")}
              options={[...STATUSES]}
            />
            <SelectField
              label="Risk"
              value={f.riskLevel}
              onChange={set("riskLevel")}
              options={[...RISKS]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type="number"
                min={0}
                step="0.01"
                value={f.value}
                onChange={(e) => set("value")(e.target.value)}
                placeholder="12000"
              />
            </div>
            <SelectField
              label="Currency"
              value={f.currency}
              onChange={set("currency")}
              options={[...CURRENCIES]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField
              label="Starts"
              value={f.startDate}
              onChange={set("startDate")}
            />
            <DateField
              label="Ends"
              value={f.endDate}
              onChange={set("endDate")}
            />
            <DateField
              label="Renewal"
              value={f.renewalDate}
              onChange={set("renewalDate")}
            />
            <div className="space-y-1.5">
              <Label htmlFor="notice">Notice (days)</Label>
              <Input
                id="notice"
                type="number"
                min={0}
                value={f.noticePeriodDays}
                onChange={(e) => set("noticePeriodDays")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={f.owner}
                onChange={(e) => set("owner")(e.target.value)}
              />
            </div>
            {entities.length > 0 && (
              <div className="space-y-1.5">
                <Label>Linked relationship</Label>
                <Select value={f.entityId} onValueChange={set("entityId")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {entities.map((en) => (
                      <SelectItem key={en.id} value={en.id}>
                        {en.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nextAction">Next action</Label>
              <Input
                id="nextAction"
                value={f.nextAction}
                onChange={(e) => set("nextAction")(e.target.value)}
                placeholder="Give notice / renegotiate"
              />
            </div>
            <DateField
              label="Next action date"
              value={f.nextActionDate}
              onChange={set("nextActionDate")}
            />
          </div>
          <AreaField
            label="Key terms"
            value={f.keyTerms}
            onChange={set("keyTerms")}
          />
          <AreaField
            label="Obligations"
            value={f.obligations}
            onChange={set("obligations")}
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
