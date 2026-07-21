import Link from "next/link";
import {
  getPlatformOverview,
  listAuditLog,
  queryPlatformWorkspaces,
  requirePlatformAdmin,
  type WorkspaceSort,
} from "@/server/services/platform-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkspaceActions } from "./WorkspaceActions";
import { WorkspaceFilters } from "./WorkspaceFilters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;

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

const statusVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  active: "secondary",
  trialing: "outline",
  past_due: "destructive",
  canceled: "destructive",
};

const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    plan?: string;
    suspended?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const { role } = await requirePlatformAdmin();
  const isOperator = role === "operator";
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const suspended =
    sp.suspended === "yes" || sp.suspended === "no" ? sp.suspended : undefined;

  const [o, audit, tenants] = await Promise.all([
    getPlatformOverview(),
    listAuditLog(25),
    queryPlatformWorkspaces({
      search: sp.search,
      status: sp.status,
      plan: sp.plan,
      suspended,
      sort: (sp.sort as WorkspaceSort) ?? "newest",
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(tenants.total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (v && k !== "page") qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    return qs.toString() ? `/admin?${qs.toString()}` : "/admin";
  };

  const stats: { label: string; value: string }[] = [
    { label: "Workspaces", value: String(o.workspaces) },
    { label: "Organisations", value: String(o.organisations) },
    { label: "Members (seats in use)", value: String(o.members) },
    { label: "Active MRR", value: money(o.activeMrrMinor) },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Jojan One management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-tenant oversight of accounts, subscriptions and usage. Customer
          business data is never shown here.
        </p>
      </div>

      {/* Headline stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Plan / status breakdowns */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            By plan
          </h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(o.byPlan).map(([k, n]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="tabular-nums text-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            By status
          </h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(o.byStatus).map(([k, n]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted-foreground">
                  {k.replace(/_/g, " ")}
                </span>
                <span className="tabular-nums text-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Subscribers */}
      <Card className="overflow-hidden p-0">
        <div className="space-y-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Subscribers ({tenants.total})
            </h2>
            <p className="text-sm text-muted-foreground">
              Every workspace across all tenants (metadata only).
            </p>
          </div>
          <WorkspaceFilters
            current={{
              search: sp.search,
              status: sp.status,
              plan: sp.plan,
              suspended: sp.suspended,
              sort: sp.sort,
            }}
            plans={Object.keys(o.byPlan).filter((k) => k !== "none")}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Created</TableHead>
                {isOperator && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isOperator ? 8 : 7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No workspaces match these filters.
                  </TableCell>
                </TableRow>
              )}
              {tenants.rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/admin/workspaces/${w.id}`}
                      className="hover:underline"
                    >
                      {w.name}
                    </Link>
                    {w.suspendedAt && (
                      <Badge variant="destructive" className="ml-2">
                        Suspended
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.org}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.planName ?? w.planKey ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[w.status ?? ""] ?? "outline"}>
                      {(w.status ?? "none").replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.seatsUsed}/{w.seatsAllowed ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(w.currentPeriodEnd)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(w.createdAt)}
                  </TableCell>
                  {isOperator && (
                    <TableCell>
                      <WorkspaceActions id={w.id} suspended={!!w.suspendedAt} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-md border border-border px-3 py-1 hover:bg-muted"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-md border border-border px-3 py-1 text-muted-foreground opacity-50">
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-md border border-border px-3 py-1 hover:bg-muted"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-md border border-border px-3 py-1 text-muted-foreground opacity-50">
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Audit log */}
      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent operator actions
        </h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <Badge variant="outline" className="shrink-0">
                  {a.action}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {a.actorEmail}
                  {a.targetWorkspaceId
                    ? ` → ${a.targetWorkspaceId.slice(0, 8)}…`
                    : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Read-only oversight. Access is limited to the PLATFORM_ADMIN_EMAILS
        allowlist and never exposes tenant business records.
      </p>
    </div>
  );
}
