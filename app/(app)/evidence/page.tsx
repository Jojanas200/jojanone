import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listEvidence } from "@/server/services/evidence";
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

const fmtDate = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  current: "secondary",
  in_review: "outline",
  expired: "destructive",
  archived: "outline",
};

export default async function EvidencePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "evidence");
  const rows = await listEvidence(claims);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Evidence library
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A dated record of the proof behind your compliance - ready for
          lenders, insurers and auditors.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No evidence recorded yet. Confirm evidence when you complete a
            compliance obligation, and it will appear here.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-foreground">
                    {e.title}
                    {e.notes && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {e.notes}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.sourceModule ?? e.category}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.fileName || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(e.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[e.status] ?? "outline"}>
                      {e.status.replace(/_/g, " ")}
                    </Badge>
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
