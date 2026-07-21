import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listDueDiligenceItems } from "@/server/services/investor";
import { NewItem } from "./NewItem";
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

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  ready: "secondary",
  in_progress: "outline",
  needs_review: "destructive",
  missing: "destructive",
  not_applicable: "outline",
};
const priorityVariant: Record<string, "outline" | "secondary" | "destructive"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

export default async function InvestorReadyPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "investor-ready");
  const rows = await listDueDiligenceItems(claims);

  const required = rows.filter(
    (r) => r.required && r.status !== "not_applicable",
  );
  const ready = required.filter((r) => r.status === "ready").length;
  const pct = required.length ? Math.round((ready / required.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Investor Ready
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Be ready before they ask
            {rows.length
              ? ` - ${ready}/${required.length} required items ready (${pct}%)`
              : "."}
          </p>
        </div>
        <WriteGate>
          <NewItem />
        </WriteGate>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No due-diligence items yet. Build your checklist so a data room is a
            short update, not a scramble.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Priority</TableHead>
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
                    {r.category.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.required ? "Yes" : "No"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[r.priority] ?? "outline"}>
                      {r.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] ?? "outline"}>
                      {r.status.replace(/_/g, " ")}
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
