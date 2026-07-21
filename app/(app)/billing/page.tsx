import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  getBillingOverview,
  listSellablePlans,
} from "@/server/services/billing";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "./BillingActions";

const money = (minor: number | null, currency: string) =>
  minor == null
    ? "Custom"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(minor / 100);

const fmtDate = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  active: "secondary",
  trialing: "outline",
  past_due: "destructive",
  canceled: "destructive",
};

export default async function BillingPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "billing");
  const ws = await getActiveWorkspaceId(claims);
  if (!ws) redirect("/onboarding");

  const [overview, plans] = await Promise.all([
    getBillingOverview(claims, ws),
    listSellablePlans(claims),
  ]);
  if (!overview) redirect("/onboarding");

  const sellable = plans.filter((p) => p.isSellable);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Billing &amp; plan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription and team seats.
        </p>
      </div>

      {/* Current plan */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {overview.planName}
              </h2>
              <Badge variant={statusVariant[overview.status] ?? "outline"}>
                {overview.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {money(overview.priceMinor, overview.currency)}
              {overview.priceMinor != null && " / month"}
              {overview.currentPeriodEnd &&
                ` · renews ${fmtDate(overview.currentPeriodEnd)}`}
              {overview.cancelAt && ` · cancels ${fmtDate(overview.cancelAt)}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-foreground">
              {overview.seatsUsed}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {overview.seatsAllowed} seats
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {overview.seatsAvailable} available
            </p>
          </div>
        </div>
        <BillingActions
          hasCustomer={overview.hasStripeCustomer}
          currentPlan={overview.planKey}
        />
      </Card>

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sellable.map((p) => {
          const current = p.key === overview.planKey;
          return (
            <Card key={p.key} className="flex flex-col p-6">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                {current && <Badge variant="secondary">Current</Badge>}
              </div>
              <p className="text-2xl font-bold text-foreground">
                {money(p.priceMinor, p.currency)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / mo
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Up to {p.seatLimit} seat{p.seatLimit === 1 ? "" : "s"}
              </p>
              <div className="mt-4">
                <BillingActions
                  hasCustomer={overview.hasStripeCustomer}
                  currentPlan={overview.planKey}
                  planKey={p.key}
                  isCurrent={current}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 p-5">
        <p className="text-sm text-foreground">
          Need more than 5 seats? Professional and Enterprise are coming later.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <a
            href="mailto:hello@jojan.one?subject=Professional/Enterprise%20plan"
            className="underline hover:no-underline"
          >
            Talk to us
          </a>{" "}
          about your team&apos;s needs.
        </p>
      </Card>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Safety notices, data exports and professional-support escalation are
        always available on every plan and are never restricted by billing.
      </p>
    </div>
  );
}
