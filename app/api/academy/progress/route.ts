import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import {
  issueCertificate,
  markLessonComplete,
} from "@/server/services/academy";
import { getBusinessProfile } from "@/server/services/settings";

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
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const asQuiz = quizSchema.safeParse(body);
  if (asQuiz.success) {
    if (asQuiz.data.quizScore < 80) return NextResponse.json({ passed: false });
    // The certificate belongs to the signed-in user and carries THEIR name:
    // auth full name first; for the owner the business primary contact can
    // stand in; the email address is the last resort.
    const [profile, role] = await Promise.all([
      getBusinessProfile(claims, ws),
      getWorkspaceRole(claims, ws),
    ]);
    const ownerFallback =
      role === "owner_admin"
        ? profile?.primaryContactName?.trim() || null
        : null;
    const certificate = await issueCertificate(claims, ws, {
      ...asQuiz.data,
      learnerId: user.sub,
      learnerName: user.fullName ?? ownerFallback ?? user.email,
    });
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
    user.sub,
  );
  if (!progress)
    return NextResponse.json({ error: "unknown course" }, { status: 404 });
  return NextResponse.json({ progress }, { status: 201 });
}
