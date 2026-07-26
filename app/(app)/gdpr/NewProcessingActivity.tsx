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

const LAWFUL_BASES = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
] as const;

const BLANK = {
  activityName: "",
  businessPurpose: "",
  dataSubjects: "",
  personalDataCategories: "",
  lawfulBasis: "consent",
  retentionPeriod: "",
  recipients: "",
  processors: "",
  securityMeasures: "",
  owner: "",
  specialCategoryData: false,
  internationalTransfers: false,
};

export function NewProcessingActivity() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ ...BLANK });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        activityName: f.activityName,
        lawfulBasis: f.lawfulBasis,
        specialCategoryData: f.specialCategoryData,
        internationalTransfers: f.internationalTransfers,
      };
      const text = (k: keyof typeof f) => {
        const v = String(f[k]).trim();
        if (v) payload[k] = v;
      };
      text("businessPurpose");
      text("dataSubjects");
      text("personalDataCategories");
      text("retentionPeriod");
      text("recipients");
      text("processors");
      text("securityMeasures");
      text("owner");

      const res = await fetch("/api/gdpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Processing activity added");
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
        <Button>New activity</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New processing activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activityName">Activity</Label>
            <Input
              id="activityName"
              required
              value={f.activityName}
              onChange={(e) => set("activityName", e.target.value)}
              placeholder="Customer enquiry handling"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessPurpose">Business purpose</Label>
            <Textarea
              id="businessPurpose"
              required
              rows={2}
              value={f.businessPurpose}
              onChange={(e) => set("businessPurpose", e.target.value)}
              placeholder="Why you process this data and what it is used for."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataSubjects">Data subjects</Label>
              <Input
                id="dataSubjects"
                value={f.dataSubjects}
                onChange={(e) => set("dataSubjects", e.target.value)}
                placeholder="Customers, prospects"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personalDataCategories">
                Personal data categories
              </Label>
              <Input
                id="personalDataCategories"
                value={f.personalDataCategories}
                onChange={(e) => set("personalDataCategories", e.target.value)}
                placeholder="Name, email, phone"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lawful basis</Label>
              <Select
                value={f.lawfulBasis}
                onValueChange={(v) => set("lawfulBasis", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAWFUL_BASES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retentionPeriod">Retention</Label>
              <Input
                id="retentionPeriod"
                required
                value={f.retentionPeriod}
                onChange={(e) => set("retentionPeriod", e.target.value)}
                placeholder="6 years"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recipients">Recipients</Label>
              <Input
                id="recipients"
                value={f.recipients}
                onChange={(e) => set("recipients", e.target.value)}
                placeholder="Who the data is shared with"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="processors">Processors</Label>
              <Input
                id="processors"
                value={f.processors}
                onChange={(e) => set("processors", e.target.value)}
                placeholder="Third-party processors"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="securityMeasures">Security measures</Label>
            <Textarea
              id="securityMeasures"
              rows={2}
              value={f.securityMeasures}
              onChange={(e) => set("securityMeasures", e.target.value)}
              placeholder="Access controls, encryption, backups…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner</Label>
            <Input
              id="owner"
              value={f.owner}
              onChange={(e) => set("owner", e.target.value)}
            />
          </div>
          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={f.specialCategoryData}
                onChange={(e) => set("specialCategoryData", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Special category data
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={f.internationalTransfers}
                onChange={(e) =>
                  set("internationalTransfers", e.target.checked)
                }
                className="h-4 w-4 rounded border-input"
              />
              International transfers
            </label>
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
