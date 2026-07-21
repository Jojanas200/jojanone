import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listObligations } from "@/server/services/compliance";
import { NewObligation } from "./NewObligation";
import { RowActions } from "./RowActions";
import { ConfirmEvidence } from "./ConfirmEvidence";
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
  action_required: "destructive",
  overdue: "destructive",
  in_progress: "secondary",
  completed: "secondary",
  upcoming: "outline",
  not_applicable: "outline",
};

const priorityVariant: Record<string, "outline" | "secondary" | "destructive"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

export default async function CompliancePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "compliance");
  const rows = await listObligations(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Compliance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every obligation, tracked automatically.
          </p>
        </div>
        <WriteGate>
          <NewObligation />
        </WriteGate>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No obligations yet. Add your statutory and regulatory obligations to
            start tracking deadlines and evidence.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Regulator</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium text-foreground">
                    {o.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.category.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.regulator || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(o.dueDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[o.priority] ?? "outline"}>
                      {o.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[o.status] ?? "outline"}>
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <WriteGate>
                      <div className="flex items-center justify-end gap-2">
                        {o.status !== "completed" &&
                          o.status !== "not_applicable" && (
                            <ConfirmEvidence
                              obligationId={o.id}
                              obligationTitle={o.title}
                            />
                          )}
                        <RowActions id={o.id} status={o.status} />
                      </div>
                    </WriteGate>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
