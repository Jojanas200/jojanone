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

const LAWFUL_BASES = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
] as const;

export function NewProcessingActivity() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    activityName: "",
    businessPurpose: "",
    dataSubjects: "",
    personalDataCategories: "",
    lawfulBasis: "consent",
    retentionPeriod: "",
    owner: "",
    specialCategoryData: false,
    internationalTransfers: false,
  });
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
      if (f.businessPurpose.trim())
        payload.businessPurpose = f.businessPurpose.trim();
      if (f.dataSubjects.trim()) payload.dataSubjects = f.dataSubjects.trim();
      if (f.personalDataCategories.trim())
        payload.personalDataCategories = f.personalDataCategories.trim();
      if (f.retentionPeriod.trim())
        payload.retentionPeriod = f.retentionPeriod.trim();
      if (f.owner.trim()) payload.owner = f.owner.trim();

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
      setF((p) => ({
        ...p,
        activityName: "",
        businessPurpose: "",
        dataSubjects: "",
        personalDataCategories: "",
        retentionPeriod: "",
        owner: "",
        specialCategoryData: false,
        internationalTransfers: false,
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
        <Button>New activity</Button>
      </DialogTrigger>
      <DialogContent>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="retentionPeriod">Retention</Label>
              <Input
                id="retentionPeriod"
                value={f.retentionPeriod}
                onChange={(e) => set("retentionPeriod", e.target.value)}
                placeholder="6 years"
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
