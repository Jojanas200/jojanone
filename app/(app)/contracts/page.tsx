import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listContracts } from "@/server/services/contracts";
import { NewContract } from "./NewContract";
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
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
        minor / 100,
      )
    : "-";

const riskVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
};

export default async function ContractsPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "contracts");
  const rows = await listContracts(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Contracts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contracts, understood at a glance.
          </p>
        </div>
        <WriteGate>
          <NewContract />
        </WriteGate>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No contracts yet. Add your first one to start tracking renewals and
            risk.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">
                    {c.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.counterparty || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.contractType}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.status.replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {money(c.valueMinor, c.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={riskVariant[c.riskLevel] ?? "outline"}>
                      {c.riskLevel}
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
