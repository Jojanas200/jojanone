import { and, desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { academyCertificates, academyProgress } from "../db/schema";
import { academyAssignments } from "../db/schema";
import { recordActivity } from "./activity";
import { getCourse } from "../../data/academy-catalog";
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from "../../shared/schemas/academy";

// Academy - learner assignments. Course content lives in the code catalogue
// (src/data/academy-catalog.ts); the DB stores who is assigned what and their
// status. All queries run through withUser() (RLS).

const courseTitle = (courseId: string) =>
  getCourse(courseId)?.title ?? courseId;

export interface EnrichedAssignment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string;
  durationMinutes: number;
  learnerId: string;
  learnerName: string | null;
  status: string;
  dueDate: string | null;
  requiredByCompany: boolean;
  legallyRequired: boolean;
  completedAt: Date | null;
}

function enrich(
  row: typeof academyAssignments.$inferSelect,
): EnrichedAssignment {
  const course = getCourse(row.courseId);
  return {
    id: row.id,
    courseId: row.courseId,
    courseTitle: course?.title ?? row.courseId,
    courseCategory: course?.category ?? "Unknown",
    durationMinutes: course?.duration_minutes ?? 0,
    learnerId: row.learnerId,
    learnerName: row.learnerName,
    status: row.status,
    dueDate: row.dueDate,
    requiredByCompany: row.requiredByCompany,
    legallyRequired: row.legallyRequired,
    completedAt: row.completedAt,
  };
}

export function listAssignments(
  claims: UserClaims,
): Promise<EnrichedAssignment[]> {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(academyAssignments)
      .orderBy(desc(academyAssignments.createdAt));
    return rows.map(enrich);
  });
}

/** Certificates earned across the workspace, newest first (RLS-scoped). */
export function listCertificates(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(academyCertificates)
      .orderBy(desc(academyCertificates.completedAt)),
  );
}

/** One certificate by id (RLS-scoped - only the owner workspace can read it). */
export function getCertificate(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(academyCertificates)
      .where(eq(academyCertificates.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

/** In-flight learning progress rows (RLS-scoped). */
export function listProgress(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(academyProgress)
      .orderBy(desc(academyProgress.lastActivityAt)),
  );
}

export function createAssignment(
  claims: UserClaims,
  workspaceId: string,
  input: CreateAssignmentInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(academyAssignments)
      .values({
        workspaceId,
        assignedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "academy",
      action: "created",
      title: courseTitle(rows[0].courseId),
      referenceId: rows[0].id,
      description: "Course assigned",
    });
    return enrich(rows[0]);
  });
}

export function updateAssignment(
  claims: UserClaims,
  id: string,
  input: UpdateAssignmentInput,
) {
  return withUser(claims, async (tx) => {
    // Stamp completed_at when transitioning into 'completed'.
    const completedAt =
      input.status === "completed"
        ? sql`now()`
        : input.status
          ? null
          : undefined;
    const rows = await tx
      .update(academyAssignments)
      .set({
        ...input,
        ...(completedAt !== undefined ? { completedAt } : {}),
      })
      .where(eq(academyAssignments.id, id))
      .returning();
    if (rows[0] && input.status) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "academy",
        action: input.status === "completed" ? "completed" : "status changed",
        title: courseTitle(rows[0].courseId),
        referenceId: rows[0].id,
        description: `Course marked ${input.status.replace(/_/g, " ")}`,
      });
    }
    return rows[0] ? enrich(rows[0]) : null;
  });
}

export function deleteAssignment(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(academyAssignments)
      .where(eq(academyAssignments.id, id))
      .returning({
        id: academyAssignments.id,
        courseId: academyAssignments.courseId,
        workspaceId: academyAssignments.workspaceId,
      });
    if (rows[0]) {
      await recordActivity(tx, rows[0].workspaceId, {
        module: "academy",
        action: "deleted",
        title: courseTitle(rows[0].courseId),
        referenceId: rows[0].id,
        description: "Course removed from learning",
      });
    }
    return rows.length > 0;
  });
}

// Convenience for tests/UI: does the learner already have this course assigned?
export function hasAssignment(
  claims: UserClaims,
  courseId: string,
  learnerId = "owner",
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({ id: academyAssignments.id })
      .from(academyAssignments)
      .where(
        and(
          eq(academyAssignments.courseId, courseId),
          eq(academyAssignments.learnerId, learnerId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });
}

// --- Lesson progress + certificates (the learning experience) ---------------

/** Record a completed lesson; stamps course completion when all are done. */
export function markLessonComplete(
  claims: UserClaims,
  workspaceId: string,
  courseId: string,
  lessonId: string,
  learnerId = "owner",
) {
  const course = getCourse(courseId);
  if (!course) return Promise.resolve(null);
  const totalLessons = course.lessons.length;
  return withUser(claims, async (tx) => {
    const existing = (
      await tx
        .select()
        .from(academyProgress)
        .where(
          and(
            eq(academyProgress.courseId, courseId),
            eq(academyProgress.learnerId, learnerId),
          ),
        )
        .limit(1)
    )[0];
    const done = new Set(existing?.lessonsCompleted ?? []);
    done.add(lessonId);
    const lessonsCompleted = [...done];
    const finished = lessonsCompleted.length >= totalLessons;
    if (existing) {
      const rows = await tx
        .update(academyProgress)
        .set({
          lessonsCompleted,
          lastActivityAt: sql`now()`,
          completedAt: finished ? sql`now()` : existing.completedAt,
        })
        .where(eq(academyProgress.id, existing.id))
        .returning();
      return rows[0];
    }
    const rows = await tx
      .insert(academyProgress)
      .values({ workspaceId, learnerId, courseId, lessonsCompleted })
      .returning();
    return rows[0];
  });
}

/** Issue a certificate for a passed final quiz (>= 80%). */
export function issueCertificate(
  claims: UserClaims,
  workspaceId: string,
  input: {
    courseId: string;
    quizScore: number;
    learnerId?: string;
    learnerName?: string | null;
  },
) {
  const course = getCourse(input.courseId);
  if (!course) return Promise.resolve(null);
  const learnerId = input.learnerId ?? "owner";
  const reference = `JO-${input.courseId
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(academyCertificates)
      .values({
        workspaceId,
        reference,
        learnerId,
        learnerName: input.learnerName ?? null,
        courseId: input.courseId,
        courseTitle: course.title,
        quizScore: input.quizScore,
        durationMinutes: course.duration_minutes,
      })
      .returning();
    // A pass also completes any open assignment for this course/learner.
    await tx
      .update(academyAssignments)
      .set({ status: "completed" })
      .where(
        and(
          eq(academyAssignments.courseId, input.courseId),
          eq(academyAssignments.learnerId, learnerId),
        ),
      );
    await recordActivity(tx, workspaceId, {
      module: "academy",
      action: "completed",
      title: `Certificate: ${course.title}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}
