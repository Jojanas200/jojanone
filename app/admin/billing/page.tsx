import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EMPTY_BILLING,
  getBillingOps,
} from "@/server/services/platform-billing";
import { getCache } from "@/server/cache/redis";
import { NewMrrChart, ChurnChart } from "./BillingCharts";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
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
const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminBillingPage() {
  const cache = getCache();
  let b = EMPTY_BILLING;
  try {
    b = await cache.getOrSet("platform:billing", 60, getBillingOps);
  } catch {
    b = EMPTY_BILLING;
  }

  const kpis = [
    { label: "MRR", value: money(b.mrrMinor), sub: `${money(b.arrMinor)} ARR` },
    {
      label: "Paying",
      value: String(b.funnel.active),
      sub: `${b.funnel.trialing} in trial`,
    },
    {
      label: "Trial → paid",
      value: `${b.conversionRate}%`,
      sub: "of ended trials",
    },
    {
      label: "Past due",
      value: String(b.funnel.pastDue),
      sub: `${b.funnel.canceled} canceled`,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Billing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue, the subscription funnel, churn and payment issues across all
          tenants.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{k.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground">
              {k.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            New MRR by month
          </h2>
          <NewMrrChart data={b.newMrrByMonth} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Cancellations by month
          </h2>
          <ChurnChart data={b.cancellationsByMonth} />
        </Card>
      </div>

      {/* Past due */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">
            Payment issues ({b.pastDue.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Subscriptions in a past-due state - candidates for dunning or
            outreach.
          </p>
        </div>
        {b.pastDue.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No past-due subscriptions. 🎉
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Period ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.pastDue.map((p) => (
                <TableRow key={p.workspaceId}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/admin/workspaces/${p.workspaceId}`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.planKey ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(p.periodEnd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Recent Stripe events */}
      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent billing events
        </h2>
        {b.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Stripe webhook events recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {b.recentEvents.map((e, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <Badge variant="outline" className="shrink-0">
                  {e.type}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {e.workspaceName ?? "-"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(e.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
