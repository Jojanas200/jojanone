import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listRisks } from "@/server/services/risk";
import { NewRisk } from "./NewRisk";
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

const ratingVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
};

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  open: "destructive",
  accepted: "secondary",
  closed: "outline",
};

function RatingBadge({
  rating,
  score,
}: {
  rating: string | null;
  score: number | null;
}) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant={ratingVariant[rating] ?? "outline"}>
      {rating}
      {score != null ? ` · ${score}` : ""}
    </Badge>
  );
}

export default async function RiskPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "risk");
  const rows = await listRisks(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Risk
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A complete picture of business risk.
          </p>
        </div>
        <WriteGate>
          <NewRisk />
        </WriteGate>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No risks yet. Add your first risk to build a live register with
            inherent and residual scoring.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Inherent</TableHead>
                <TableHead>Residual</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    {r.riskTitle}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.riskCategory.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <RatingBadge
                      rating={r.inherentRating}
                      score={r.inherentScore}
                    />
                  </TableCell>
                  <TableCell>
                    <RatingBadge
                      rating={r.residualRating}
                      score={r.residualScore}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.riskOwner || "-"}
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
