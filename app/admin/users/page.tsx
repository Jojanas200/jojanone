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
import { listPlatformUsers } from "@/server/services/platform-users";
import { UserSearch } from "./UserSearch";

const PAGE_SIZE = 25;

const fmtDate = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listPlatformUsers({
    search: sp.search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (sp.search) qs.set("search", sp.search);
    if (p > 1) qs.set("page", String(p));
    return qs.toString() ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Users
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every user across all tenants. Look up an account for support or a
          data-subject request.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <UserSearch initial={sp.search} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="hover:underline"
                      >
                        {u.email ?? u.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {u.bannedUntil ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : u.confirmedAt ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Unconfirmed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(u.lastSignInAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · {total} users
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-md border border-border px-3 py-1 hover:bg-muted"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-md border border-border px-3 py-1 hover:bg-muted"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
