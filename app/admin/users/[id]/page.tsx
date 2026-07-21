import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlatformUser } from "@/server/services/platform-users";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { UserActions } from "./UserActions";

const fmtDateTime = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-GB") : "-";
const roleLabel = (r: string) =>
  r === "owner_admin" ? "Owner" : r.replace(/_/g, " ");

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ role }, user] = await Promise.all([
    requirePlatformAdmin(),
    getPlatformUser(id),
  ]);
  if (!user) notFound();
  const isOperator = role === "operator";

  return (
    <div>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All users
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {user.email ?? user.id.slice(0, 8)}
        </h1>
        {user.bannedUntil ? (
          <Badge variant="destructive">Disabled</Badge>
        ) : user.confirmedAt ? (
          <Badge variant="secondary">Active</Badge>
        ) : (
          <Badge variant="outline">Unconfirmed</Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Account
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              ["User ID", user.id],
              ["Joined", fmtDateTime(user.createdAt)],
              ["Last sign-in", fmtDateTime(user.lastSignInAt)],
              ["Email confirmed", fmtDateTime(user.confirmedAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="break-all text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Actions
          </h2>
          {isOperator ? (
            <UserActions
              id={user.id}
              email={user.email}
              disabled={!!user.bannedUntil}
              confirmed={!!user.confirmedAt}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              User actions require operator access.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">
            Memberships ({user.memberships.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Workspaces this user belongs to, across all tenants.
          </p>
        </div>
        {user.memberships.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No workspace memberships.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {user.memberships.map((m) => (
              <li
                key={m.workspaceId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <Link
                  href={`/admin/workspaces/${m.workspaceId}`}
                  className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline"
                >
                  {m.workspaceName}
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {m.org}
                  </span>
                </Link>
                <Badge variant="secondary">{roleLabel(m.role)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
