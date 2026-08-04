"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { OPTIONAL_MODULES } from "@/shared/plans/entitlements";

export type DesignerPlan = {
  key: string;
  name: string;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  billingInterval: string;
  seatLimit: number | null;
  features: string[];
  trialDays: number;
  isSellable: boolean;
  isHighlighted: boolean;
  isTrialDefault: boolean;
  published: boolean;
  stripePriceId: string | null;
  sortOrder: number;
};

const money = (minor: number | null, currency: string) =>
  minor === null
    ? "-"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
      }).format(minor / 100);

export function PlanDesigner({
  plans,
  canWrite,
}: {
  plans: DesignerPlan[];
  canWrite: boolean;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-3">
      {plans.map((p) => (
        <PlanCard key={p.key} plan={p} canWrite={canWrite} />
      ))}

      {canWrite &&
        (creating ? (
          <NewPlanForm onDone={() => setCreating(false)} />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New package
          </Button>
        ))}
    </div>
  );
}

function PlanCard({
  plan,
  canWrite,
}: {
  plan: DesignerPlan;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: plan.name,
    description: plan.description ?? "",
    price: plan.priceMinor === null ? "" : String(plan.priceMinor / 100),
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    seats: plan.seatLimit === null ? "" : String(plan.seatLimit),
    trialDays: String(plan.trialDays),
    isSellable: plan.isSellable,
    isHighlighted: plan.isHighlighted,
    isTrialDefault: plan.isTrialDefault,
    sortOrder: String(plan.sortOrder),
    features: new Set(plan.features),
  });

  async function send(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans/${plan.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      toast.success(okMsg);
      if (data?.warning) toast.warning(data.warning, { duration: 9000 });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    send(
      {
        name: f.name,
        description: f.description.trim() || null,
        priceMinor: f.price.trim() ? Math.round(Number(f.price) * 100) : null,
        currency: f.currency,
        billingInterval: f.billingInterval,
        seatLimit: f.seats.trim() ? Number(f.seats) : null,
        trialDays: Number(f.trialDays || 0),
        features: [...f.features],
        isSellable: f.isSellable,
        isHighlighted: f.isHighlighted,
        isTrialDefault: f.isTrialDefault,
        sortOrder: Number(f.sortOrder || 0),
      },
      "Package saved",
    );

  async function archive() {
    if (
      !window.confirm(
        `Retire "${plan.name}"? It disappears from pricing and can no longer be bought. Existing subscribers keep their access.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans/${plan.key}`, {
        method: "DELETE",
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Package retired");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggleFeature = (key: string) =>
    setF((p) => {
      const next = new Set(p.features);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...p, features: next };
    });

  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {plan.name}
            </span>
            <span className="block font-mono text-[11px] text-muted-foreground">
              {plan.key} · {money(plan.priceMinor, plan.currency)}
              {plan.priceMinor ? `/${plan.billingInterval}` : ""} ·{" "}
              {plan.seatLimit ?? "unlimited"} seats · {plan.features.length}{" "}
              optional modules
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {plan.trialDays > 0 && (
            <Badge variant="outline">{plan.trialDays}-day trial</Badge>
          )}
          {plan.priceMinor !== null &&
            plan.priceMinor > 0 &&
            !plan.stripePriceId && (
              <Badge variant="destructive">Not in Stripe</Badge>
            )}
          <Badge variant={plan.published ? "success" : "outline"}>
            {plan.published ? "Published" : "Draft"}
          </Badge>
          {canWrite && (
            <Button
              size="sm"
              variant={plan.published ? "outline" : "default"}
              disabled={busy}
              onClick={() =>
                send(
                  { published: !plan.published },
                  plan.published
                    ? "Withdrawn from the pricing page"
                    : "Published to the pricing page",
                )
              }
            >
              {plan.published ? "Withdraw" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name">
              <Input
                value={f.name}
                disabled={!canWrite}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label={`Price (${f.currency})`}>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0 = free"
                value={f.price}
                disabled={!canWrite}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </Field>
            <Field label="Billing period">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={f.billingInterval}
                disabled={!canWrite}
                onChange={(e) =>
                  setF({ ...f, billingInterval: e.target.value })
                }
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </Field>
            <Field label="Free trial (days)">
              <Input
                type="number"
                min={0}
                max={365}
                value={f.trialDays}
                disabled={!canWrite}
                onChange={(e) => setF({ ...f, trialDays: e.target.value })}
              />
            </Field>
            <Field label="Seat limit">
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={f.seats}
                disabled={!canWrite}
                onChange={(e) => setF({ ...f, seats: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={f.currency}
                maxLength={3}
                disabled={!canWrite}
                onChange={(e) =>
                  setF({ ...f, currency: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Order on pricing page">
              <Input
                type="number"
                min={0}
                value={f.sortOrder}
                disabled={!canWrite}
                onChange={(e) => setF({ ...f, sortOrder: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Input
                value={f.description}
                placeholder="Shown on the pricing card"
                disabled={!canWrite}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <p className="text-xs font-medium text-foreground">
              Modules this package unlocks
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Compliance, risk, people, contracts, data protection, governance,
              policies and evidence are included in every package - the Business
              Confidence Score is derived from them.
            </p>
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {OPTIONAL_MODULES.map((m) => (
                <label
                  key={m.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-foreground">{m.title}</span>
                  <Switch
                    checked={f.features.has(m.key)}
                    disabled={!canWrite}
                    onCheckedChange={() => toggleFeature(m.key)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={f.isSellable}
                disabled={!canWrite}
                onCheckedChange={(v) => setF({ ...f, isSellable: v === true })}
              />
              <span className="text-muted-foreground">Sellable</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={f.isHighlighted}
                disabled={!canWrite}
                onCheckedChange={(v) =>
                  setF({ ...f, isHighlighted: v === true })
                }
              />
              <span className="text-muted-foreground">
                Highlight as most popular
              </span>
            </label>
            {/* Exactly one package can hold this; saving it here clears it
                everywhere else. The trial's length is this package's own
                trial days. */}
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={f.isTrialDefault}
                disabled={!canWrite}
                onCheckedChange={(v) =>
                  setF({ ...f, isTrialDefault: v === true })
                }
              />
              <span className="text-muted-foreground">
                Give new signups this package on trial
              </span>
            </label>
            {canWrite && (
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={archive}
                >
                  Retire
                </Button>
                <Button size="sm" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save package"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewPlanForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    key: "",
    name: "",
    price: "",
    trialDays: "0",
    seats: "",
  });

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: f.key,
          name: f.name,
          priceMinor: f.price.trim() ? Math.round(Number(f.price) * 100) : null,
          trialDays: Number(f.trialDays || 0),
          seatLimit: f.seats.trim() ? Number(f.seats) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      toast.success(
        "Package created as a draft - set its modules, then publish",
      );
      if (data?.warning) toast.warning(data.warning, { duration: 9000 });
      onDone();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">New package</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Key">
          <Input
            value={f.key}
            placeholder="essentials"
            onChange={(e) => setF({ ...f, key: e.target.value })}
          />
        </Field>
        <Field label="Name">
          <Input
            value={f.name}
            placeholder="Essentials"
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <Field label="Price (GBP)">
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0 = free"
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
          />
        </Field>
        <Field label="Free trial (days)">
          <Input
            type="number"
            min={0}
            max={365}
            value={f.trialDays}
            onChange={(e) => setF({ ...f, trialDays: e.target.value })}
          />
        </Field>
        <Field label="Seat limit">
          <Input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={f.seats}
            onChange={(e) => setF({ ...f, seats: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={create}
          disabled={busy || !f.key.trim() || !f.name.trim()}
        >
          {busy ? "Creating…" : "Create package"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
