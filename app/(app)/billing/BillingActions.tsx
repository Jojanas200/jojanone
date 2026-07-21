"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ORDER: Record<string, number> = { starter: 1, growth: 2 };

export function BillingActions({
  hasCustomer,
  currentPlan,
  planKey,
  isCurrent,
}: {
  hasCustomer: boolean;
  currentPlan: string;
  planKey?: string;
  isCurrent?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function go(path: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  // Per-plan button (on a plan card).
  if (planKey) {
    if (isCurrent)
      return (
        <Button variant="outline" className="w-full" disabled>
          Current plan
        </Button>
      );
    const upgrade = (ORDER[planKey] ?? 0) > (ORDER[currentPlan] ?? 0);
    return (
      <Button
        className="w-full"
        disabled={busy}
        onClick={() => go("/api/billing/checkout", { planKey })}
      >
        {busy ? "Starting…" : upgrade ? "Upgrade" : "Switch to this plan"}
      </Button>
    );
  }

  // Top-of-page manage button (only meaningful once a Stripe customer exists).
  if (!hasCustomer) return null;
  return (
    <div className="mt-4">
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => go("/api/billing/portal")}
      >
        {busy ? "Opening…" : "Manage billing"}
      </Button>
    </div>
  );
}
