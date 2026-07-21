"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["trialing", "active", "past_due", "canceled"];

export function SubscriptionOverride({
  workspaceId,
  plans,
  current,
}: {
  workspaceId: string;
  plans: { key: string; name: string; seatLimit: number | null }[];
  current: { planKey: string; status: string; seatsAllowed: number };
}) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(current.planKey);
  const [status, setStatus] = useState(current.status);
  const [seats, setSeats] = useState(String(current.seatsAllowed));
  const [trialDays, setTrialDays] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const seatsNum = Number(seats);
    if (!Number.isInteger(seatsNum) || seatsNum < 1) {
      toast.error("Seats must be a whole number of at least 1.");
      return;
    }
    const payload: Record<string, unknown> = {
      planKey,
      status,
      seatsAllowed: seatsNum,
    };
    if (trialDays.trim()) {
      const d = Number(trialDays);
      if (!Number.isInteger(d) || d < 1) {
        toast.error("Trial days must be a positive whole number.");
        return;
      }
      payload.trialDays = d;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/workspaces/${workspaceId}/subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Subscription overridden");
      setTrialDays("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={planKey} onValueChange={setPlanKey}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seats">Seats allowed</Label>
          <Input
            id="seats"
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48 space-y-1.5">
          <Label htmlFor="trial">Extend trial (days)</Label>
          <Input
            id="trial"
            type="number"
            min={1}
            placeholder="e.g. 14"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Apply override"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Applies directly to the workspace, bypassing Stripe. Every change is
        written to the audit log. Extending the trial also sets status to
        trialing.
      </p>
    </div>
  );
}
