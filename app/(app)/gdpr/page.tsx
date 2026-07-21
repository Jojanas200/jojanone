import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listProcessingActivities } from "@/server/services/gdpr";
import { NewProcessingActivity } from "./NewProcessingActivity";
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

export default async function GdprPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "gdpr");
  const rows = await listProcessingActivities(claims);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            GDPR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data protection, handled properly - your record of processing
            activities.
          </p>
        </div>
        <WriteGate>
          <NewProcessingActivity />
        </WriteGate>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No processing activities yet. Map how you use personal data to build
            your ROPA.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Data subjects</TableHead>
                <TableHead>Lawful basis</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-foreground">
                    {a.activityName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.dataSubjects || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.lawfulBasis?.replace(/_/g, " ") || "-"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {a.specialCategoryData && (
                      <Badge variant="destructive">special category</Badge>
                    )}
                    {a.internationalTransfers && (
                      <Badge variant="secondary">intl transfer</Badge>
                    )}
                    {!a.specialCategoryData && !a.internationalTransfers && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={a.status === "active" ? "outline" : "secondary"}
                    >
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <WriteGate>
                      <RowActions id={a.id} status={a.status} />
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
