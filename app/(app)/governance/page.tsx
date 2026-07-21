import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listGovernanceRecords } from "@/server/services/governance";
import { NewRecord } from "./NewRecord";
import { RowActions } from "./RowActions";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";
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
  pending: "secondary",
  approved: "secondary",
  completed: "secondary",
  deferred: "outline",
  rejected: "destructive",
};

export default async function GovernancePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "governance");
  const rows = await listGovernanceRecords(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Governance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Board-level discipline, without the overhead.
          </p>
        </div>
        <WriteGate>
          <NewRecord />
        </WriteGate>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="governance" title="Governance" />
      </WriteGate>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No records yet. Log board meetings, resolutions and decisions to
            keep an audit-ready trail.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Decision maker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    {r.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.recordType.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(r.meetingDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.decisionMaker || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] ?? "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <WriteGate>
                      <RowActions id={r.id} status={r.status} />
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
