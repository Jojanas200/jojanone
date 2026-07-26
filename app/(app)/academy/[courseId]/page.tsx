import { notFound, redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listCertificates, listProgress } from "@/server/services/academy";
import { getCourse } from "@/data/academy-catalog";
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

  const [progress, certificates] = await Promise.all([
    listProgress(claims),
    listCertificates(claims),
  ]);
  const mine = progress.find(
    (p) => p.courseId === courseId && p.learnerId === "owner",
  );
  const cert = certificates.find((c) => c.courseId === courseId) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <CoursePlayer
        courseId={courseId}
        completedLessons={mine?.lessonsCompleted ?? []}
        certificate={
          cert
            ? {
                reference: cert.reference,
                quizScore: cert.quizScore,
                completedAt: cert.completedAt.toISOString(),
              }
            : null
        }
        canWrite={access.canWrite}
      />
    </div>
  );
}
