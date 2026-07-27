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
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // Per-course learning state for the signed-in owner.
  const byCourse = new Map(
    progress
      .filter((p) => p.learnerId === "owner")
      .map((p) => {
        const total = getCourse(p.courseId)?.lessons.length ?? 0;
        const pct =
          total > 0
            ? Math.min(
                100,
                Math.round((p.lessonsCompleted.length / total) * 100),
              )
            : 0;
        return [
          p.courseId,
          {
            pct,
            done: p.lessonsCompleted.length,
            total,
            completedAt: p.completedAt,
            lastActivityAt: p.lastActivityAt,
          },
        ] as const;
      }),
  );
  const certified = new Set(certificates.map((c) => c.courseId));
  const inProgress = [...byCourse.entries()]
    .filter(([id, s]) => !s.completedAt && !certified.has(id) && s.done > 0)
    .sort(
      (a, b) =>
        (b[1].lastActivityAt?.getTime() ?? 0) -
        (a[1].lastActivityAt?.getTime() ?? 0),
    );
  const completedCourses = COURSES.filter(
    (c) => certified.has(c.id) || byCourse.get(c.id)?.completedAt,
  );

  const completionPcts = [...byCourse.values()].map((s) => s.pct / 100);
  const overallPct =
    completionPcts.length > 0
      ? Math.round(
          (completionPcts.reduce((a, b) => a + b, 0) / completionPcts.length) *
            100,
        )
      : 0;
  const learningStats = [
    { label: "Assigned", value: assignments.length },
    {
      label: "Completed",
      value: assignments.filter((a) => a.status === "completed").length,
    },
    { label: "In progress", value: inProgress.length },
    { label: "Overdue", value: overdueCount },
    { label: "Overall progress", value: `${overallPct}%` },
    { label: "Certificates", value: certificates.length },
  ];

  const courses: CatalogueCourse[] = COURSES.map((c) => {
    const s = byCourse.get(c.id);
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.short_description,
      duration: c.duration_minutes,
      difficulty: c.difficulty,
      progressPct: s?.pct ?? null,
      completed: certified.has(c.id) || !!s?.completedAt,
    };
  });
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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {learningStats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="learning">
        <TabsList>
          <TabsTrigger value="learning">My Learning</TabsTrigger>
          <TabsTrigger value="library">
            Course Library ({COURSES.length})
          </TabsTrigger>
          <TabsTrigger value="certificates">
            Certificates{certificates.length ? ` (${certificates.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* --- My Learning --------------------------------------------------- */}
        <TabsContent value="learning" className="mt-6 space-y-8">
          {/* Continue learning */}
          {inProgress.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Continue learning
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map(([courseId, s]) => {
                  const course = getCourse(courseId);
                  if (!course) return null;
                  return (
                    <Card key={courseId} className="flex flex-col gap-2 p-4">
                      <p className="text-sm font-semibold text-foreground">
                        {course.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <Progress value={s.pct} className="h-1.5" />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.pct}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.done} of {s.total} lessons complete
                      </p>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="mt-auto w-fit"
                      >
                        <Link href={`/academy/${courseId}`}>Resume course</Link>
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Completed */}
          {completedCourses.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Completed
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {completedCourses.map((c) => {
                  const cert = certificates.find((x) => x.courseId === c.id);
                  return (
                    <Card key={c.id} className="flex flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {c.title}
                        </p>
                        <Badge variant="success" className="shrink-0">
                          Completed
                        </Badge>
                      </div>
                      {cert ? (
                        <p className="text-xs text-muted-foreground">
                          Certificate {cert.reference} · {cert.quizScore}%
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Lessons complete - pass the final quiz to earn the
                          certificate.
                        </p>
                      )}
                      <div className="mt-auto flex gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/academy/${c.id}`}>Open course</Link>
                        </Button>
                        {cert && (
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`/api/academy/certificates/${cert.id}/pdf`}
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                              Certificate
                            </a>
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recommended for your business */}
          {recommendations.length > 0 && (
            <section>
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
                        variant={
                          r.priority === "high" ? "destructive" : "outline"
                        }
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

          {/* Assigned learning (own + team) */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Assigned learning
              </h2>
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
                  Nothing assigned yet. Add a course from the Course Library.
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
        </TabsContent>

        {/* --- Course Library ------------------------------------------------ */}
        <TabsContent value="library" className="mt-6">
          <Catalogue courses={courses} assignedIds={assignedIds} />
        </TabsContent>

        {/* --- Certificates -------------------------------------------------- */}
        <TabsContent value="certificates" className="mt-6">
          {certificates.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No certificates yet. Complete a course and pass its final quiz
              (80%) to earn a Jojan One Certificate of Completion.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Download</TableHead>
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
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.reference}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <a href={`/api/academy/certificates/${c.id}/pdf`}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            PDF
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
