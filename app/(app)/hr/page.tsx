import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listEmployees } from "@/server/services/hr";
import { NewEmployee } from "./NewEmployee";
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

// green-ish (secondary) when satisfied, destructive when outstanding/overdue.
const rtwVariant: Record<string, "secondary" | "destructive" | "outline"> = {
  verified: "secondary",
  not_required: "outline",
  outstanding: "destructive",
  expired: "destructive",
};
const trainingVariant: Record<string, "secondary" | "destructive" | "outline"> =
  {
    complete: "secondary",
    outstanding: "destructive",
    overdue: "destructive",
  };
const riskVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
};

export default async function HrPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "hr");
  const rows = await listEmployees(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            HR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People risk, made visible.
          </p>
        </div>
        <WriteGate>
          <NewEmployee />
        </WriteGate>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="hr" title="HR" />
      </WriteGate>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No people yet. Add your team to track right-to-work, training and
            review obligations.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Right to work</TableHead>
                <TableHead>Training</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-foreground">
                    {e.fullName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.jobTitle || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.employmentStatus}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rtwVariant[e.rightToWorkStatus] ?? "outline"}
                    >
                      {e.rightToWorkStatus.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={trainingVariant[e.trainingStatus] ?? "outline"}
                    >
                      {e.trainingStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={riskVariant[e.riskLevel] ?? "outline"}>
                      {e.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <WriteGate>
                      <RowActions id={e.id} status={e.employmentStatus} />
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
