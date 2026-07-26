import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import {
  listAssignments,
  listCertificates,
  listProgress,
} from "@/server/services/academy";
import { COURSES, getCourse } from "@/data/academy-catalog";
import { buildCourseRecommendations } from "@/server/services/academy-insights";
import Link from "next/link";
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
import { AssignTraining } from "./AssignTraining";
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

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  assigned: "outline",
  in_progress: "warning",
  completed: "success",
  overdue: "destructive",
};

export default async function AcademyPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "academy");
  const [assignments, certificates, progress, recommendations] =
    await Promise.all([
      listAssignments(claims),
      listCertificates(claims),
      listProgress(claims),
      buildCourseRecommendations(claims),
    ]);
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = assignments.filter(
    (a) => a.status !== "completed" && a.dueDate && a.dueDate < today,
  ).length;
  const completionPcts = progress.map((p) => {
    const total = getCourse(p.courseId)?.lessons.length ?? 0;
    return total > 0 ? Math.min(1, p.lessonsCompleted.length / total) : 0;
  });
  const overallPct =
    completionPcts.length > 0
      ? Math.round(
          (completionPcts.reduce((a, b) => a + b, 0) / completionPcts.length) *
            100,
        )
      : 0;
  const completedCount = assignments.filter(
    (a) => a.status === "completed",
  ).length;
  const inProgressCount = progress.filter((p) => !p.completedAt).length;
  const learningStats = [
    { label: "Assigned", value: assignments.length },
    { label: "Completed", value: completedCount },
    { label: "In progress", value: inProgressCount },
    { label: "Overdue", value: overdueCount },
    { label: "Overall progress", value: `${overallPct}%` },
    { label: "Certificates", value: certificates.length },
  ];

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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Academy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build capability, close knowledge gaps and keep a clear learning
          record.
        </p>
      </div>

      {/* Learning summary */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {learningStats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Recommended for your business */}
      {recommendations.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Recommended for your business
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((r) => (
              <Card key={r.courseId} className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {r.title}
                  </p>
                  <Badge
                    variant={r.priority === "high" ? "destructive" : "outline"}
                    className="shrink-0 capitalize"
                  >
                    {r.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                <div className="mt-auto flex items-center gap-3 pt-2 text-sm">
                  <Link
                    href={`/academy/${r.courseId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Open course
                  </Link>
                  {r.assigned && (
                    <Badge variant="outline">In your learning</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Learning (own + team) */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Learning</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Generate training report
            </Link>
            <WriteGate>
              <AssignTraining courses={courses} />
            </WriteGate>
          </div>
        </div>
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
                  <TableHead>Learner</TableHead>
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
                      {a.learnerName ||
                        (a.learnerId === "owner" ? "You" : a.learnerId)}
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

      {/* Certificates */}
      {certificates.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Certificates
          </h2>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">
                      {c.courseTitle ?? c.courseId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.learnerName ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.quizScore}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(c.completedAt.toISOString())}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.reference}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}

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
