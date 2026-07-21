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
  "compliance",
  "contracts",
  "data_protection",
  "cyber",
  "people",
  "financial",
  "operational",
  "supplier",
  "strategic",
] as const;
const RESPONSES = ["avoid", "reduce", "transfer", "accept", "monitor"] as const;
const EFFECTIVENESS = ["strong", "adequate", "weak", "none"] as const;
const SCALE = ["1", "2", "3", "4", "5"];

function ScaleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCALE.map((n) => (
          <SelectItem key={n} value={n}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function NewRisk() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    riskTitle: "",
    riskCategory: "operational",
    likelihood: "3",
    impact: "3",
    residualLikelihood: "2",
    residualImpact: "2",
    controlEffectiveness: "adequate",
    response: "reduce",
    riskOwner: "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        riskTitle: f.riskTitle,
        riskCategory: f.riskCategory,
        likelihood: Number(f.likelihood),
        impact: Number(f.impact),
        residualLikelihood: Number(f.residualLikelihood),
        residualImpact: Number(f.residualImpact),
        controlEffectiveness: f.controlEffectiveness,
        response: f.response,
      };
      if (f.riskOwner.trim()) payload.riskOwner = f.riskOwner.trim();

      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Risk added");
      setOpen(false);
      setF((p) => ({ ...p, riskTitle: "", riskOwner: "" }));
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
        <Button>New risk</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New risk</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="riskTitle">Risk</Label>
            <Input
              id="riskTitle"
              required
              value={f.riskTitle}
              onChange={(e) => set("riskTitle")(e.target.value)}
              placeholder="Key supplier concentration"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={f.riskCategory}
                onValueChange={set("riskCategory")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Response</Label>
              <Select value={f.response} onValueChange={set("response")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Inherent likelihood</Label>
              <ScaleSelect value={f.likelihood} onChange={set("likelihood")} />
            </div>
            <div className="space-y-1.5">
              <Label>Inherent impact</Label>
              <ScaleSelect value={f.impact} onChange={set("impact")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Residual likelihood</Label>
              <ScaleSelect
                value={f.residualLikelihood}
                onChange={set("residualLikelihood")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Residual impact</Label>
              <ScaleSelect
                value={f.residualImpact}
                onChange={set("residualImpact")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Controls</Label>
              <Select
                value={f.controlEffectiveness}
                onValueChange={set("controlEffectiveness")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFECTIVENESS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="riskOwner">Owner</Label>
            <Input
              id="riskOwner"
              value={f.riskOwner}
              onChange={(e) => set("riskOwner")(e.target.value)}
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
