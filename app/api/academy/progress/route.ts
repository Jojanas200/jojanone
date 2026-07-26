import { NextResponse } from "next/server";
import { z } from "zod";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  issueCertificate,
  markLessonComplete,
} from "@/server/services/academy";

const lessonSchema = z.object({
  courseId: z.string().min(1).max(80),
  lessonId: z.string().min(1).max(80),
});
const quizSchema = z.object({
  courseId: z.string().min(1).max(80),
  quizScore: z.number().int().min(0).max(100),
});

// POST { courseId, lessonId } marks a lesson complete;
// POST { courseId, quizScore } records a final-quiz result (>= 80 = pass ->
// certificate). Grading happens client-side from the shared catalogue; the
// pass threshold is enforced here.
export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const asQuiz = quizSchema.safeParse(body);
  if (asQuiz.success) {
    if (asQuiz.data.quizScore < 80) return NextResponse.json({ passed: false });
    const certificate = await issueCertificate(claims, ws, asQuiz.data);
    if (!certificate)
      return NextResponse.json({ error: "unknown course" }, { status: 404 });
    return NextResponse.json({ passed: true, certificate }, { status: 201 });
  }
  const parsed = lessonSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  const progress = await markLessonComplete(
    claims,
    ws,
    parsed.data.courseId,
    parsed.data.lessonId,
  );
  if (!progress)
    return NextResponse.json({ error: "unknown course" }, { status: 404 });
  return NextResponse.json({ progress }, { status: 201 });
}
