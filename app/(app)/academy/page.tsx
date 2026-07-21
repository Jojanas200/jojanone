import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listAssignments } from "@/server/services/academy";
import { COURSES } from "@/data/academy-catalog";
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
import { Catalogue, type CatalogueCourse } from "./Catalogue";
import { RowActions } from "./RowActions";
import { WriteGate } from "../WriteGate";

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  assigned: "outline",
  in_progress: "secondary",
  completed: "secondary",
  overdue: "destructive",
};

export default async function AcademyPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "academy");
  const assignments = await listAssignments(claims);

  const courses: CatalogueCourse[] = COURSES.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    description: c.short_description,
    duration: c.duration_minutes,
    difficulty: c.difficulty,
  }));
  const assignedIds = assignments.map((a) => a.courseId);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Academy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build capability, close knowledge gaps and keep a clear learning
          record.
        </p>
      </div>

      {/* My learning */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          My learning
        </h2>
        <Card className="overflow-hidden p-0">
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nothing assigned yet. Add a course from the catalogue below.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-foreground">
                      {a.courseTitle}
                      {a.legallyRequired && (
                        <Badge variant="destructive" className="ml-2">
                          Legally required
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.courseCategory}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(a.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] ?? "outline"}>
                        {a.status.replace(/_/g, " ")}
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
      </section>

      {/* Catalogue */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Course catalogue
        </h2>
        <Catalogue courses={courses} assignedIds={assignedIds} />
      </section>
    </div>
  );
}
