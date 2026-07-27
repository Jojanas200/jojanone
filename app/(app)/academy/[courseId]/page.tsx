import { notFound, redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listCertificates, listProgress } from "@/server/services/academy";
import { getCourse, type CourseQuizQuestion } from "@/data/academy-catalog";
import { getQuestionSet } from "@/server/services/question-sets";
import { CoursePlayer } from "./CoursePlayer";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "academy");
  const course = getCourse(courseId);
  if (!course) notFound();

  const [progress, certificates, quizRaw] = await Promise.all([
    listProgress(claims),
    listCertificates(claims),
    getQuestionSet(`academy_quiz:${courseId}`),
  ]);
  const quiz = quizRaw as unknown as CourseQuizQuestion[];
  const isOwner = access.role === "owner_admin";
  const mineOf = (learnerId: string) =>
    learnerId === claims.sub || (isOwner && learnerId === "owner");
  const mine = progress.find(
    (p) => p.courseId === courseId && mineOf(p.learnerId),
  );
  const cert =
    certificates.find((c) => c.courseId === courseId && mineOf(c.learnerId)) ??
    null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <CoursePlayer
        courseId={courseId}
        completedLessons={mine?.lessonsCompleted ?? []}
        certificate={
          cert
            ? {
                id: cert.id,
                reference: cert.reference,
                quizScore: cert.quizScore,
                completedAt: cert.completedAt.toISOString(),
              }
            : null
        }
        canWrite={access.canWrite}
        quiz={quiz}
      />
    </div>
  );
}
