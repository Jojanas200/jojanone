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

const CATEGORIES = [
  "companies_house",
  "tax",
  "vat",
  "payroll",
  "pensions",
  "insurance",
  "employment",
  "data_protection",
  "health_safety",
  "insurance_business",
  "governance",
  "other",
] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const RECURRENCES = [
  "none",
  "annual",
  "quarterly",
  "monthly",
  "weekly",
] as const;

const nice = (s: string) => s.replace(/_/g, " ");

export function NewObligation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    title: "",
    category: "companies_house",
    regulator: "",
    priority: "medium",
    dueDate: "",
    recurrence: "none",
    owner: "",
    reasonApplies: "",
    plainLanguageExplanation: "",
    requiredAction: "",
    notes: "",
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
        priority: f.priority,
        recurrence: f.recurrence,
      };
      if (f.regulator.trim()) payload.regulator = f.regulator.trim();
      if (f.dueDate) payload.dueDate = f.dueDate;
      if (f.owner.trim()) payload.owner = f.owner.trim();
      if (f.reasonApplies.trim())
        payload.reasonApplies = f.reasonApplies.trim();
      if (f.plainLanguageExplanation.trim())
        payload.plainLanguageExplanation = f.plainLanguageExplanation.trim();
      if (f.requiredAction.trim())
        payload.requiredAction = f.requiredAction.trim();
      if (f.notes.trim()) payload.notes = f.notes.trim();

      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Obligation added");
      setOpen(false);
      setF((p) => ({
        ...p,
        title: "",
        regulator: "",
        dueDate: "",
        owner: "",
        reasonApplies: "",
        plainLanguageExplanation: "",
        requiredAction: "",
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
        <Button>New obligation</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New obligation</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={f.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Confirmation statement (CS01)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={f.category} onValueChange={set("category")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {nice(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regulator">Regulator</Label>
              <Input
                id="regulator"
                value={f.regulator}
                onChange={(e) => set("regulator")(e.target.value)}
                placeholder="Companies House"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={f.priority} onValueChange={set("priority")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={f.recurrence} onValueChange={set("recurrence")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={f.dueDate}
                onChange={(e) => set("dueDate")(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner</Label>
            <Input
              id="owner"
              value={f.owner}
              onChange={(e) => set("owner")(e.target.value)}
              placeholder="Who is responsible?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reasonApplies">Why it applies</Label>
            <Textarea
              id="reasonApplies"
              rows={2}
              value={f.reasonApplies}
              onChange={(e) => set("reasonApplies")(e.target.value)}
              placeholder="Why this obligation applies to your business"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plain">Plain-language explanation</Label>
            <Textarea
              id="plain"
              rows={3}
              value={f.plainLanguageExplanation}
              onChange={(e) => set("plainLanguageExplanation")(e.target.value)}
              placeholder="What this means, in plain English"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requiredAction">Required action</Label>
            <Textarea
              id="requiredAction"
              rows={2}
              value={f.requiredAction}
              onChange={(e) => set("requiredAction")(e.target.value)}
              placeholder="What you need to do to meet it"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={f.notes}
              onChange={(e) => set("notes")(e.target.value)}
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
