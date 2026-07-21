import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listPolicies } from "@/server/services/policies";
import { NewPolicy } from "./NewPolicy";
import { RowActions } from "./RowActions";
import { WriteGate } from "../WriteGate";
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

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  draft: "outline",
  active: "secondary",
  archived: "destructive",
};

const ackLabel: Record<string, string> = {
  not_started: "Not started",
  partial: "Partial",
  complete: "Complete",
};

const isOverdue = (d: string | null) =>
  !!d && new Date(d).getTime() < Date.now();

export default async function PoliciesPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "policies");

  const rows = await listPolicies(claims);

  const active = rows.filter((r) => r.status === "active").length;
  const dueReview = rows.filter(
    (r) => r.status !== "archived" && isOverdue(r.reviewDate),
  ).length;
  const ackOutstanding = rows.filter(
    (r) => r.acknowledgementRequired && r.acknowledgementStatus !== "complete",
  ).length;

  const stats = [
    { label: "Policies", value: rows.length },
    { label: "Active", value: active },
    { label: "Due for review", value: dueReview },
    { label: "Sign-off outstanding", value: ackOutstanding },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Policies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The policies your business relies on - versioned, owned, reviewed on
            a schedule, with staff sign-off tracked.
          </p>
        </div>
        <WriteGate>
          <NewPolicy />
        </WriteGate>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sign-off</TableHead>
                <TableHead>Review</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No policies yet. Add your first one to start a register.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/policies/${p.id}`}
                        className="text-foreground hover:underline"
                      >
                        {p.policyName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.policyCategory ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.version}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.owner ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status] ?? "outline"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.acknowledgementRequired
                        ? (ackLabel[p.acknowledgementStatus] ??
                          p.acknowledgementStatus)
                        : "Not required"}
                    </TableCell>
                    <TableCell
                      className={
                        p.status !== "archived" && isOverdue(p.reviewDate)
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {fmtDate(p.reviewDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <WriteGate>
                        <RowActions id={p.id} status={p.status} />
                      </WriteGate>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Guidance to help you maintain your policies - not legal advice. Have
        material policies reviewed by a qualified professional.
      </p>
    </div>
  );
}
