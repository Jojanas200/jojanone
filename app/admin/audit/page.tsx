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
  listActivityModules,
  listAuditActions,
  listOperatorAudit,
  listTenantActivity,
} from "@/server/services/platform-audit";
import { AuditFilter } from "./AuditFilter";

const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; module?: string }>;
}) {
  const { action, module } = await searchParams;
  const [operator, actions, activity, modules] = await Promise.all([
    listOperatorAudit({ action, limit: 100 }),
    listAuditActions(),
    listTenantActivity({ module, limit: 100 }),
    listActivityModules(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Audit &amp; activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator actions across every tenant, and the in-app activity feed for
          all workspaces.
        </p>
      </div>

      {/* Operator actions */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">
            Operator actions ({operator.length})
          </h2>
          <AuditFilter
            param="action"
            label="Action"
            options={actions}
            value={action ?? null}
            params={{ action, module }}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operator.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No operator actions recorded.
                  </TableCell>
                </TableRow>
              ) : (
                operator.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline">{r.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.actorEmail}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.targetWorkspaceId ? (
                        <Link
                          href={`/admin/workspaces/${r.targetWorkspaceId}`}
                          className="hover:underline"
                        >
                          {r.targetWorkspaceName ??
                            `${r.targetWorkspaceId.slice(0, 8)}…`}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Tenant activity */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">
            Tenant activity ({activity.length})
          </h2>
          <AuditFilter
            param="module"
            label="Module"
            options={modules}
            value={module ?? null}
            params={{ action, module }}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No tenant activity recorded.
                  </TableCell>
                </TableRow>
              ) : (
                activity.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-xs truncate font-medium text-foreground">
                      {a.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.module}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link
                        href={`/admin/workspaces/${a.workspaceId}`}
                        className="hover:underline"
                      >
                        {a.workspaceName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.actorEmail ?? (
                        <span className="text-xs italic">system</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(a.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
