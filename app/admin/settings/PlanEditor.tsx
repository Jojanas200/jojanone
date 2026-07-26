"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Plan = {
  key: string;
  name: string;
  priceMinor: number | null;
  currency: string;
  seatLimit: number | null;
  isSellable: boolean;
};

export function PlanEditor({ plans }: { plans: Plan[] }) {
  return (
    <div className="space-y-3">
      {plans.map((p) => (
        <PlanRow key={p.key} plan={p} />
      ))}
    </div>
  );
}

function PlanRow({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(
    plan.priceMinor == null ? "" : String(plan.priceMinor / 100),
  );
  const [seats, setSeats] = useState(
    plan.seatLimit == null ? "" : String(plan.seatLimit),
  );
  const [sellable, setSellable] = useState(plan.isSellable);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name, isSellable: sellable };
      body.priceMinor = price.trim() ? Math.round(Number(price) * 100) : null;
      body.seatLimit = seats.trim() ? Number(seats) : null;
      const res = await fetch(`/api/admin/plans/${plan.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(`${plan.key} updated`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
      <div className="w-16 shrink-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Key
        </p>
        <p className="text-sm font-medium text-foreground">{plan.key}</p>
      </div>
      <div className="w-40 space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="w-24 space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Price (£/mo)
        </label>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="-"
          className="h-8"
          inputMode="decimal"
        />
      </div>
      <div className="w-20 space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Seats
        </label>
        <Input
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          placeholder="∞"
          className="h-8"
          inputMode="numeric"
        />
      </div>
      <label className="flex items-center gap-2 pb-1.5 text-xs text-muted-foreground">
        <Switch
          checked={sellable}
          onCheckedChange={(v) => setSellable(v === true)}
        />
        Sellable
      </label>
      <Button size="sm" onClick={save} disabled={saving} className="ml-auto">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
