import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Check,
  Star,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCoreData,
  updateBillingCycle,
  applyBillingPlanChange,
  cancelBillingPrototype,
  reactivateBillingPrototype,
} from "@/data/store";
import type {
  BillingCycle,
  BillingPlanId,
} from "@/data/settings-types";

type Plan = {
  id: BillingPlanId;
  name: string;
  tagline: string;
  monthly: number | null; // null = custom
  userLimit: number | null; // null = custom
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For sole traders and very small businesses.",
    monthly: 39,
    userLimit: 1,
    features: [
      "1 user",
      "Dashboard and Executive",
      "Timeline and Reports",
      "Jova business guidance",
      "Core compliance tracking",
      "Basic Academy access",
      "Data export",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing small businesses.",
    monthly: 99,
    userLimit: 5,
    popular: true,
    features: [
      "Up to 5 users",
      "All Starter features",
      "Contracts and HR",
      "GDPR, Governance and Risk",
      "Investor Ready and Tender Ready",
      "Full Academy access",
      "Branded reports and certificates",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "For established businesses and advisory teams.",
    monthly: 249,
    userLimit: 20,
    features: [
      "Up to 20 users",
      "All Growth features",
      "Advanced roles and permissions",
      "Expanded reporting",
      "Priority support",
      "Advanced data-room and tender workflows",
      "Multiple business workspaces (Planned)",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For larger organisations and partner deployments.",
    monthly: null,
    userLimit: null,
    features: [
      "Custom user limits",
      "Custom onboarding",
      "SSO (Planned)",
      "API access (Planned)",
      "Dedicated support",
      "Custom integrations",
      "Contracted pricing",
    ],
  },
];

const ROADMAP: string[] = [
  "Production authentication",
  "Organisation and workspace model",
  "Server-side permissions",
  "Stripe or equivalent payment provider",
  "Secure hosted checkout",
  "Webhook verification",
  "Subscription entitlement service",
  "Invoice and tax handling",
  "Failed-payment recovery",
  "Cancellation and refund workflow",
  "Secure production database",
  "Audit logging",
  "Privacy and retention controls",
];

function formatMoney(n: number) {
  return `£${n.toLocaleString("en-GB")}`;
}

function priceLabel(plan: Plan, cycle: BillingCycle): string {
  if (plan.monthly == null) return "Custom";
  if (cycle === "annual") {
    const annual = Math.round(plan.monthly * 12 * 0.85);
    return `${formatMoney(annual)}/year`;
  }
  return `${formatMoney(plan.monthly)}/month`;
}

function priceSummary(plan: Plan, cycle: BillingCycle): string {
  if (plan.monthly == null) return "Custom pricing - contact us";
  if (cycle === "annual") {
    const annual = Math.round(plan.monthly * 12 * 0.85);
    return `${formatMoney(annual)}/year (annual, ~15% saving)`;
  }
  return `${formatMoney(plan.monthly)}/month`;
}

export function BillingSection() {
  const settings = useCoreData((s) => s.app_settings);
  const users = useCoreData((s) => s.app_users);
  const reports = useCoreData((s) => s.reports);
  const conversations = useCoreData((s) => s.conversations);
  const academyAssignments = useCoreData((s) => s.academy_assignments);
  const certificates = useCoreData((s) => s.academy_certificates);
  const currentUser = users.find((u) => u.role === "owner_admin");
  const isOwner = !!currentUser; // prototype: default to Owner/Admin view when present
  const billing = settings.billing;
  const branding = settings.branding;

  const currentPlan = PLANS.find((p) => p.id === billing.plan_id) ?? PLANS[0];
  const [pending, setPending] = useState<Plan | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  const activeUsers = users.filter((u) => u.status === "active").length;
  const monthAgo = Date.now() - 30 * 86400000;
  const reportsThisMonth = reports.filter(
    (r) => new Date(r.created_at).getTime() >= monthAgo,
  ).length;

  const storageBytes = useMemo(() => {
    try {
      if (typeof window === "undefined") return 0;
      const raw = window.localStorage.getItem("jojan_one_core_v1");
      return raw ? new Blob([raw]).size : 0;
    } catch {
      return 0;
    }
  }, [settings.last_saved_at]);

  const nextBilling = "Not scheduled";
  const paymentMethod = "Not connected";

  const chooseLabel = (p: Plan) => {
    if (p.id === currentPlan.id) return "Current plan";
    if (p.id === "enterprise") return "Contact us";
    if (!currentPlan.monthly || (p.monthly ?? 0) > (currentPlan.monthly ?? 0))
      return `Upgrade to ${p.name}`;
    return `Choose ${p.name}`;
  };

  const confirmPlanChange = () => {
    if (!pending) return;
    applyBillingPlanChange({
      plan_id: pending.id,
      plan_label: pending.name,
      cycle: billing.cycle,
      price_summary: priceSummary(pending, billing.cycle),
    });
    toast.success(`Prototype plan set to ${pending.name}. No payment was taken.`);
    setPending(null);
  };

  const scrollToPlans = () => {
    document
      .getElementById("plan-comparison")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const usersLimit = currentPlan.userLimit;
  const usersOverLimit =
    usersLimit != null && activeUsers > usersLimit;

  return (
    <div className="flex flex-col gap-6">
      {/* Prototype notice */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Prototype notice.</strong> Subscription management and payment
          processing are not currently connected. No real charges will be made
          and no payment details should be entered.
        </p>
      </div>

      {/* Current plan summary */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
              <CreditCard className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
                Plans &amp; Billing
              </h2>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                {branding.display_name || "Your business"} · Manage the
                prototype subscription for Jojan One.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {billing.status === "active_prototype"
                ? "Active prototype"
                : "Cancelled prototype"}
            </Badge>
            <Button size="sm" onClick={scrollToPlans}>
              Manage plan
            </Button>
          </div>
        </div>

        <Separator className="my-5" />

        <dl className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem
            label="Current plan"
            value={currentPlan.name}
            hint={priceSummary(currentPlan, billing.cycle)}
          />
          <SummaryItem
            label="Billing cycle"
            value={billing.cycle === "annual" ? "Annual" : "Monthly"}
          />
          <SummaryItem label="Next billing date" value={nextBilling} />
          <SummaryItem
            label="Users"
            value={
              usersLimit
                ? `${activeUsers} of ${usersLimit}`
                : `${activeUsers} (custom)`
            }
          />
          <SummaryItem
            label="Data storage"
            value="Browser storage only"
            hint="Prototype demonstration - no server database is connected."
          />
          <SummaryItem label="Payment method" value={paymentMethod} />
          <SummaryItem
            label="Status"
            value={
              billing.status === "active_prototype"
                ? "Active (prototype)"
                : "Cancelled (prototype)"
            }
          />
          <SummaryItem
            label="Last updated"
            value={new Date(billing.changed_at).toLocaleString()}
          />
        </dl>
      </Card>

      {/* Cycle selector */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Billing cycle
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Choose how prices are displayed. Selection is saved locally - no
              payment is taken.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1"
          >
            {(["monthly", "annual"] as BillingCycle[]).map((c) => {
              const active = billing.cycle === c;
              return (
                <button
                  key={c}
                  role="tab"
                  aria-selected={active}
                  disabled={!isOwner}
                  onClick={() => updateBillingCycle(c)}
                  className={
                    "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors " +
                    (active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {c === "monthly" ? "Monthly" : "Annual"}
                  {c === "annual" && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                      Save 15%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {!isOwner && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Owner/Admin access is required to
            manage the subscription.
          </p>
        )}
      </Card>

      {/* Plan comparison */}
      <section id="plan-comparison" className="scroll-mt-20">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-foreground">
              Compare plans
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Core safety notices, professional-support escalation and data
              export are included in every plan.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const isCurrent = p.id === currentPlan.id;
            return (
              <Card
                key={p.id}
                className={
                  "relative flex flex-col p-5 " +
                  (p.popular
                    ? "border-primary/40 shadow-sm ring-1 ring-primary/10"
                    : "")
                }
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    <Star className="h-3 w-3" /> Most popular
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Current plan
                  </span>
                )}
                <div className="mb-2">
                  <h4 className="text-[16px] font-semibold text-foreground">
                    {p.name}
                  </h4>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {p.tagline}
                  </p>
                </div>
                <div className="mb-4">
                  <div className="text-[22px] font-semibold tracking-tight text-foreground">
                    {priceLabel(p, billing.cycle)}
                  </div>
                  {p.monthly != null && billing.cycle === "annual" && (
                    <div className="text-[11.5px] text-muted-foreground">
                      Equivalent to ~
                      {formatMoney(Math.round(p.monthly * 0.85))}/month
                    </div>
                  )}
                </div>
                <ul className="mb-5 flex flex-1 flex-col gap-2 text-[13px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        strokeWidth={2}
                      />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? "outline" : p.popular ? "default" : "secondary"}
                  disabled={isCurrent || !isOwner}
                  onClick={() => setPending(p)}
                >
                  {chooseLabel(p)}
                </Button>
                {!isOwner && !isCurrent && (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    Owner/Admin access is required.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[12px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5" />
          Safety notices, professional-support escalation, Jova non-advice
          safeguards and data export are always available and are never gated by
          plan.
        </p>
      </section>

      {/* Plan usage */}
      <Card className="p-6">
        <h3 className="text-[15px] font-semibold text-foreground">Plan usage</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Live counts drawn from your prototype data. Entitlement enforcement is
          not active in this prototype.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <UsageItem
            label="Users"
            value={activeUsers}
            limit={usersLimit ?? null}
          />
          <UsageItem label="Reports generated (last 30 days)" value={reportsThisMonth} />
          <UsageItem label="Jova conversations" value={conversations.length} />
          <UsageItem label="Academy assignments" value={academyAssignments.length} />
          <UsageItem label="Certificates" value={certificates.length} />
          <UsageItem
            label="Prototype browser storage"
            value={`${(storageBytes / 1024).toFixed(1)} KB`}
          />
        </div>
        {usersOverLimit && (
          <div
            role="note"
            className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Prototype overage:</strong> this workspace has{" "}
              {activeUsers} users against the {currentPlan.name} allowance of{" "}
              {usersLimit}. Plan limits are displayed for demonstration but are
              not currently enforced.
            </p>
          </div>
        )}
      </Card>

      {/* Billing history */}
      <Card className="p-6">
        <h3 className="text-[15px] font-semibold text-foreground">
          Billing history
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No billing transactions yet. Billing history will appear here
                  after a payment provider is connected.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment method */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Payment method
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Payment provider not connected.
            </p>
            <p className="mt-2 max-w-xl text-[12px] text-muted-foreground">
              Card details will only be collected through a secure payment
              provider in production. Jojan One will not store raw card details.
            </p>
          </div>
          <Button variant="outline" disabled>
            Add payment method
          </Button>
        </div>
      </Card>

      {/* Subscription controls */}
      <Card className="p-6">
        <h3 className="text-[15px] font-semibold text-foreground">
          Subscription controls
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ControlRow
            title="Change billing cycle"
            description="Switch between monthly and annual pricing view."
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={!isOwner}
                onClick={() =>
                  updateBillingCycle(billing.cycle === "monthly" ? "annual" : "monthly")
                }
              >
                {billing.cycle === "monthly" ? "Switch to annual" : "Switch to monthly"}
              </Button>
            }
          />
          <ControlRow
            title="Change plan"
            description="Compare plans and select a prototype subscription."
            action={
              <Button variant="outline" size="sm" onClick={scrollToPlans}>
                Compare plans
              </Button>
            }
          />
          <ControlRow
            title="Cancel subscription"
            description="Prototype cancellation only. Business records are preserved."
            action={
              billing.status === "cancelled_prototype" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isOwner}
                  onClick={() => {
                    reactivateBillingPrototype();
                    toast.success("Prototype subscription marked active.");
                  }}
                >
                  Reactivate (prototype)
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isOwner}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel subscription
                </Button>
              )
            }
          />
        </div>
      </Card>

      {/* Access control note */}
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="text-[13px] text-muted-foreground">
            Only <strong className="text-foreground">Owner/Admin</strong> users can
            manage billing. Other prototype roles may view the plan but see
            disabled management controls. These permissions are not yet securely
            enforced - production authentication and server-side authorisation
            are required before enforcement can be relied on.
          </div>
        </div>
      </Card>

      {/* Production roadmap */}
      <Card className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setRoadmapOpen((v) => !v)}
          aria-expanded={roadmapOpen}
          className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-accent/40"
        >
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Production billing requirements
            </h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              What must be connected before this becomes a real subscription
              system.
            </p>
          </div>
          {roadmapOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {roadmapOpen && (
          <div className="border-t border-border px-6 py-4">
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {ROADMAP.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-[13px]"
                >
                  <span className="text-foreground/90">{item}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    <AlertTriangle className="h-3 w-3" /> Not connected
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Plan change confirmation dialog */}
      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm prototype plan change</DialogTitle>
            <DialogDescription>
              This is a prototype plan selection. No payment will be taken.
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
              <SummaryItem label="Current plan" value={currentPlan.name} />
              <SummaryItem label="Selected plan" value={pending.name} />
              <SummaryItem
                label="Price"
                value={priceSummary(pending, billing.cycle)}
              />
              <SummaryItem
                label="Included users"
                value={
                  (currentPlan.userLimit ?? "Custom") +
                  " → " +
                  (pending.userLimit ?? "Custom")
                }
              />
              <SummaryItem
                label="Effective date"
                value="Immediately (prototype)"
              />
              <SummaryItem label="Payment" value="None taken" />
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPlanChange}>Confirm prototype plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription (prototype)</DialogTitle>
            <DialogDescription>
              No cancellation is sent to a payment provider in this prototype.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-foreground/85">
            <li>Cancelling does not delete business records.</li>
            <li>All data remains exportable from Data Management.</li>
            <li>
              A separate, confirmed data-deletion process is required to remove
              records.
            </li>
            <li>No cancellation is actually sent in this prototype.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                cancelBillingPrototype();
                setCancelOpen(false);
                toast.success("Prototype cancellation recorded. Records preserved.");
              }}
            >
              Record prototype cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[14px] font-medium text-foreground">{value}</dd>
      {hint && (
        <dd className="text-[11.5px] text-muted-foreground">{hint}</dd>
      )}
    </div>
  );
}

function UsageItem({
  label,
  value,
  limit,
}: {
  label: string;
  value: number | string;
  limit?: number | null;
}) {
  const numeric = typeof value === "number" ? value : null;
  const showBar = limit != null && numeric != null;
  const pct = showBar ? Math.min(100, Math.round((numeric! / limit!) * 100)) : 0;
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-[13.5px] font-semibold text-foreground">
          {showBar ? `${numeric} / ${limit}` : value}
        </span>
      </div>
      {showBar && <Progress value={pct} className="mt-2 h-1.5" />}
    </div>
  );
}

function ControlRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <div>
        <div className="text-[13.5px] font-medium text-foreground">{title}</div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}