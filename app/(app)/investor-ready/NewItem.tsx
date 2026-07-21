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

const CATEGORIES = [
  "corporate",
  "financial",
  "legal",
  "compliance",
  "commercial",
  "people",
  "data_room",
] as const;
const STATUSES = [
  "missing",
  "in_progress",
  "ready",
  "needs_review",
  "not_applicable",
] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

export function NewItem() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    title: "",
    category: "corporate",
    status: "missing",
    priority: "medium",
    owner: "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title,
        category: f.category,
        status: f.status,
        priority: f.priority,
      };
      if (f.owner.trim()) payload.owner = f.owner.trim();

      const res = await fetch("/api/investor-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Item added");
      setOpen(false);
      setF((p) => ({ ...p, title: "", owner: "" }));
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
        <Button>New item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New due-diligence item</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Item</Label>
            <Input
              id="title"
              required
              value={f.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Cap table"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {sel("Category", "category", CATEGORIES)}
            {sel("Priority", "priority", PRIORITIES)}
            {sel("Status", "status", STATUSES)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner</Label>
            <Input
              id="owner"
              value={f.owner}
              onChange={(e) => set("owner")(e.target.value)}
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
