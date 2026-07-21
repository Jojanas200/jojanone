import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  getPlatformWorkspaceDetail,
  listAuditLogForWorkspace,
  listPlans,
} from "@/server/services/platform-tenants";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { listTenantNotes } from "@/server/services/platform-support";
import { WorkspaceActions } from "../../WorkspaceActions";
import { SubscriptionOverride } from "./SubscriptionOverride";
import { TenantSupport } from "./TenantSupport";

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
const roleLabel = (r: string) =>
  r === "owner_admin" ? "Owner" : r.replace(/_/g, " ");

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ role }, detail, plans, audit, notes] = await Promise.all([
    requirePlatformAdmin(),
    getPlatformWorkspaceDetail(id),
    listPlans(),
    listAuditLogForWorkspace(id, 25),
    listTenantNotes(id),
  ]);
  if (!detail) notFound();
  const isOperator = role === "operator";

  const sub = detail.subscription;

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All tenants
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {detail.name}
            </h1>
            {detail.suspendedAt && (
              <Badge variant="destructive">Suspended</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.org} · created {fmtDate(detail.createdAt)} ·{" "}
            {detail.seatsUsed}/{sub?.seatsAllowed ?? "-"} seats used
          </p>
        </div>
        {isOperator && (
          <WorkspaceActions id={detail.id} suspended={!!detail.suspendedAt} />
        )}
      </div>

      {/* Subscription & quota */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Subscription &amp; quota
          </h2>
          {sub && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {sub.hasStripeSubscription ? (
                <Badge variant="outline">Stripe-linked</Badge>
              ) : (
                <Badge variant="outline">No Stripe subscription</Badge>
              )}
              {sub.currentPeriodEnd && (
                <span>renews/ends {fmtDate(sub.currentPeriodEnd)}</span>
              )}
            </div>
          )}
        </div>
        {isOperator ? (
          <SubscriptionOverride
            workspaceId={detail.id}
            plans={plans}
            current={{
              planKey: sub?.planKey ?? plans[0]?.key ?? "starter",
              status: sub?.status ?? "trialing",
              seatsAllowed: sub?.seatsAllowed ?? 1,
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {sub?.planName ?? sub?.planKey ?? "-"} ·{" "}
            {(sub?.status ?? "none").replace(/_/g, " ")} · {detail.seatsUsed}/
            {sub?.seatsAllowed ?? "-"} seats. Overrides require operator access.
          </p>
        )}
      </Card>

      {/* Support tooling */}
      {isOperator && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            Support
          </h2>
          <TenantSupport
            workspaceId={detail.id}
            notes={notes.map((n) => ({
              ...n,
              createdAt: n.createdAt as unknown as string,
            }))}
          />
        </Card>
      )}

      {/* Members */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">
            Members ({detail.members.length})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-foreground">
                  {m.email ?? `${m.userId.slice(0, 8)}…`}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(m.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Tenant audit */}
      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent actions on this tenant
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
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
