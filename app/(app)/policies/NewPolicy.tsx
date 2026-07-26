"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { POLICY_CATEGORIES } from "@/shared/schemas/policies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export function NewPolicy() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    policyName: "",
    policyCategory: POLICY_CATEGORIES[0] as string,
    version: "1.0",
    owner: "",
    purpose: "",
    reviewDate: "",
    acknowledgementRequired: false,
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        policyName: f.policyName,
        policyCategory: f.policyCategory,
        version: f.version || "1.0",
        acknowledgementRequired: f.acknowledgementRequired,
      };
      if (f.owner.trim()) payload.owner = f.owner.trim();
      if (f.reviewDate) payload.reviewDate = f.reviewDate;
      // Seed the document body with a Purpose section so it is captured up front
      // and shows on the policy page (editable there, or draftable with Jova).
      if (f.purpose.trim())
        payload.content = `Purpose\n\n${f.purpose.trim()}\n`;

      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Policy added");
      setOpen(false);
      setF((p) => ({
        ...p,
        policyName: "",
        owner: "",
        purpose: "",
        reviewDate: "",
        acknowledgementRequired: false,
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
        <Button>New policy</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New policy</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="policyName">Policy name</Label>
            <Input
              id="policyName"
              required
              value={f.policyName}
              onChange={(e) => set("policyName")(e.target.value)}
              placeholder="Data Protection Policy"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={f.policyCategory}
                onValueChange={set("policyCategory")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={f.version}
                onChange={(e) => set("version")(e.target.value)}
                placeholder="1.0"
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
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewDate">Next review</Label>
              <Input
                id="reviewDate"
                type="date"
                value={f.reviewDate}
                onChange={(e) => set("reviewDate")(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              rows={3}
              value={f.purpose}
              onChange={(e) => set("purpose")(e.target.value)}
              placeholder="What this policy is for and why it matters. This becomes the opening section of the document."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="ack">Requires staff sign-off</Label>
              <p className="text-xs text-muted-foreground">
                Track acknowledgements from your team.
              </p>
            </div>
            <Switch
              id="ack"
              checked={f.acknowledgementRequired}
              onCheckedChange={(v) =>
                set("acknowledgementRequired")(v === true)
              }
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
