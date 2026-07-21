import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listTenderOpportunities } from "@/server/services/tender";
import { NewOpportunity } from "./NewOpportunity";
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

const money = (minor: number, currency: string) =>
  minor
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(minor / 100)
    : "-";

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  identified: "outline",
  assessing: "outline",
  bid: "secondary",
  drafting: "secondary",
  submitted: "secondary",
  won: "secondary",
  no_bid: "outline",
  lost: "destructive",
  archived: "outline",
};

export default async function TenderReadyPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "tender-ready");
  const rows = await listTenderOpportunities(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tender Ready
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Win more of the contracts you bid for.
          </p>
        </div>
        <WriteGate>
          <NewOpportunity />
        </WriteGate>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No opportunities yet. Track tenders, deadlines and bid decisions in
            one place.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Deadline</TableHead>
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
                    {o.authority || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {money(o.contractValue, o.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(o.submissionDeadline)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[o.status] ?? "outline"}>
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <WriteGate>
                      <RowActions id={o.id} status={o.status} />
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
