"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Award, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCourse,
  ACADEMY_DISCLAIMER,
  type CourseLesson,
  type CourseQuizQuestion,
  type LessonCheckQuestion,
} from "@/data/academy-catalog";
import { printDocument } from "../../_shared/print";

type Cert = { reference: string; quizScore: number; completedAt: string };

const strengthTone: Record<string, string> = {
  best: "border-emerald-500/50 bg-emerald-500/10",
  acceptable: "border-border bg-muted/40",
  risky: "border-amber-500/50 bg-amber-500/10",
  wrong: "border-destructive/50 bg-destructive/10",
};

export function CoursePlayer({
  courseId,
  completedLessons,
  certificate,
  canWrite,
  quiz,
}: {
  courseId: string;
  completedLessons: string[];
  certificate: Cert | null;
  canWrite: boolean;
  quiz?: CourseQuizQuestion[];
}) {
  const router = useRouter();
  const course = getCourse(courseId)!;
  const [done, setDone] = useState(new Set(completedLessons));
  const [lessonIx, setLessonIx] = useState(() => {
    const i = course.lessons.findIndex((l) => !completedLessons.includes(l.id));
    return i === -1 ? 0 : i;
  });
  const [quizOpen, setQuizOpen] = useState(false);
  const [cert, setCert] = useState(certificate);
  const lesson = course.lessons[lessonIx];
  const pct = Math.round((done.size / course.lessons.length) * 100);

  async function completeLesson() {
    const res = await fetch("/api/academy/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId: lesson.id }),
    });
    if (!res.ok) {
      toast.error("Could not save progress");
      return;
    }
    setDone((p) => new Set([...p, lesson.id]));
    toast.success("Lesson complete");
    if (lessonIx < course.lessons.length - 1) setLessonIx(lessonIx + 1);
    router.refresh();
  }

  function printCertificate() {
    if (!cert) return;
    printDocument({
      title: "Certificate of completion",
      meta: `Jojan One Academy · ${cert.reference}`,
      blocks: [
        { kind: "text", heading: "Course", body: course.title },
        {
          kind: "rows",
          rows: [
            ["Quiz score", `${cert.quizScore}%`],
            [
              "Completed",
              new Date(cert.completedAt).toLocaleDateString("en-GB"),
            ],
            ["Duration", `${course.duration_minutes} minutes`],
            ["Reference", cert.reference],
          ],
        },
      ],
      disclaimer: ACADEMY_DISCLAIMER,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/academy"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Academy
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {course.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {course.category} · {course.difficulty} ·{" "}
              {course.duration_minutes} mins · {course.audience}
            </p>
          </div>
          <div className="flex gap-2">
            {course.resource && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  printDocument({
                    title: course.resource!.title,
                    meta: `Jojan One Academy · ${course.title}`,
                    blocks: course.resource!.sections.map((s) => ({
                      kind: "list",
                      heading: s.heading,
                      items: s.items,
                    })),
                    disclaimer: ACADEMY_DISCLAIMER,
                  })
                }
              >
                Print resource
              </Button>
            )}
            {canWrite && (
              <Button size="sm" onClick={() => setQuizOpen(true)}>
                {cert ? "Retake quiz" : "Take final quiz"}
              </Button>
            )}
          </div>
        </div>
        <Progress value={pct} className="mt-4" />
        <p className="mt-1 text-xs text-muted-foreground">
          {done.size} of {course.lessons.length} lessons complete ({pct}%)
        </p>
      </div>

      {cert && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Award className="h-4 w-4 text-emerald-600" />
            Certificate earned - {cert.quizScore}% ·{" "}
            <span className="font-mono text-xs">{cert.reference}</span>
          </p>
          <Button size="sm" variant="outline" onClick={printCertificate}>
            Print certificate
          </Button>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lessons
          </p>
          <ul className="space-y-1">
            {course.lessons.map((l, i) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setLessonIx(i)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    i === lessonIx
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {done.has(l.id) ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <span className="w-4 shrink-0 text-center text-xs">
                      {i + 1}
                    </span>
                  )}
                  <span className="truncate">{l.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Objectives
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {course.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>

        <LessonPanel
          key={lesson.id}
          lesson={lesson}
          done={done.has(lesson.id)}
          canWrite={canWrite}
          onComplete={completeLesson}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">{ACADEMY_DISCLAIMER}</p>

      {quizOpen && (
        <QuizDialog
          courseId={courseId}
          quiz={quiz ?? course.quiz}
          onClose={() => setQuizOpen(false)}
          onPassed={(c) => {
            setCert(c);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LessonPanel({
  lesson: l,
  done,
  canWrite,
  onComplete,
}: {
  lesson: CourseLesson;
  done: boolean;
  canWrite: boolean;
  onComplete: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const pickedOption = l.scenario.options.find((o) => o.id === picked);

  return (
    <Card className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{l.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{l.objective}</p>
      </div>

      <Section heading="Learn">
        <p className="whitespace-pre-wrap text-sm text-foreground">{l.learn}</p>
      </Section>

      <Section heading={`Example - ${l.example.business}`}>
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {l.example.body}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Why it matters: {l.example.why}
        </p>
      </Section>

      <Section heading="Apply it">
        <p className="text-sm font-medium text-foreground">
          {l.scenario.prompt}
        </p>
        <div className="mt-2 space-y-2">
          {l.scenario.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPicked(o.id)}
              className={`block w-full rounded-lg border p-3 text-left text-sm transition ${
                picked === o.id
                  ? strengthTone[o.strength]
                  : "border-border hover:border-foreground/30"
              }`}
            >
              {o.label}
              {picked === o.id && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  <Badge
                    variant={
                      o.strength === "best"
                        ? "secondary"
                        : o.strength === "wrong" || o.strength === "risky"
                          ? "destructive"
                          : "outline"
                    }
                    className="mr-1.5 capitalize"
                  >
                    {o.strength}
                  </Badge>
                  {o.feedback}
                </span>
              )}
            </button>
          ))}
        </div>
        {pickedOption && pickedOption.strength !== "best" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Try again - there is a stronger option.
          </p>
        )}
      </Section>

      <Section heading="Take action">
        <p className="text-sm font-medium text-foreground">{l.action.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {l.action.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {l.action.route && (
            <Link
              href={l.action.route}
              className="font-medium text-primary hover:underline"
            >
              Open module
            </Link>
          )}
          {l.action.ask_jova && (
            <Link
              href={`/jova?q=${encodeURIComponent(l.action.ask_jova)}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Ask Jova
            </Link>
          )}
        </div>
      </Section>

      <Section heading="Check your understanding">
        <div className="space-y-4">
          {l.checks.map((c) => (
            <CheckQuestion key={c.id} check={c} />
          ))}
        </div>
      </Section>

      <Section heading="Recap">
        <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
          {l.recap.takeaways.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Common mistake: {l.recap.common_mistake}
        </p>
        {l.recap.professional_support && (
          <p className="mt-1 text-xs text-muted-foreground">
            {l.recap.professional_support}
          </p>
        )}
      </Section>

      <div className="border-t border-border pt-4">
        {done ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Lesson complete
          </p>
        ) : canWrite ? (
          <Button onClick={onComplete}>Mark lesson complete</Button>
        ) : null}
      </div>
    </Card>
  );
}

function CheckQuestion({ check: c }: { check: LessonCheckQuestion }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const correct =
    revealed &&
    selected.length === c.correct.length &&
    c.correct.every((i) => selected.includes(i));

  function toggle(i: number) {
    if (revealed) return;
    if (c.kind === "multi")
      setSelected((p) =>
        p.includes(i) ? p.filter((x) => x !== i) : [...p, i],
      );
    else {
      setSelected([i]);
      setRevealed(true);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">{c.question}</p>
      <div className="mt-2 space-y-1.5">
        {c.options.map((o, i) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(i)}
            className={`block w-full rounded-md border px-3 py-1.5 text-left text-sm ${
              selected.includes(i)
                ? revealed
                  ? c.correct.includes(i)
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-destructive/50 bg-destructive/10"
                  : "border-foreground/40"
                : "border-border hover:border-foreground/30"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {c.kind === "multi" && !revealed && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs"
          disabled={selected.length === 0}
          onClick={() => setRevealed(true)}
        >
          Check answer
        </Button>
      )}
      {revealed && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Badge
            variant={correct ? "secondary" : "destructive"}
            className="mr-1.5"
          >
            {correct ? "Correct" : "Not quite"}
          </Badge>
          {c.explanation}
        </p>
      )}
    </div>
  );
}

function QuizDialog({
  courseId,
  quiz,
  onClose,
  onPassed,
}: {
  courseId: string;
  quiz: CourseQuizQuestion[];
  onClose: () => void;
  onPassed: (c: Cert) => void;
}) {
  const course = getCourse(courseId)!;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const allAnswered = quiz.every((q) => answers[q.id] !== undefined);

  async function submit() {
    const right = quiz.filter((q) => answers[q.id] === q.correct_index).length;
    const score = Math.round((right / quiz.length) * 100);
    setGraded(score);
    if (score >= 80) {
      setSaving(true);
      try {
        const res = await fetch("/api/academy/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, quizScore: score }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Failed");
        toast.success(`Passed with ${score}% - certificate issued`);
        onPassed({
          reference: data.certificate.reference,
          quizScore: score,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Final quiz - {course.title}</DialogTitle>
          <DialogDescription>
            {quiz.length} questions · 80% to pass · unlimited retries.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {quiz.map((q, qi) => {
            const chosen = answers[q.id];
            const wrong =
              graded !== null &&
              chosen !== undefined &&
              chosen !== q.correct_index;
            return (
              <div key={q.id}>
                <p className="text-sm font-medium text-foreground">
                  {qi + 1}. {q.question}
                </p>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((o, i) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() =>
                        graded === null &&
                        setAnswers((p) => ({ ...p, [q.id]: i }))
                      }
                      className={`block w-full rounded-md border px-3 py-1.5 text-left text-sm ${
                        chosen === i
                          ? graded === null
                            ? "border-foreground/40"
                            : i === q.correct_index
                              ? "border-emerald-500/50 bg-emerald-500/10"
                              : "border-destructive/50 bg-destructive/10"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                {wrong && q.explanation && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-border pt-4">
            {graded === null ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(answers).length} of {quiz.length} answered
                </p>
                <Button onClick={submit} disabled={!allAnswered || saving}>
                  Submit quiz
                </Button>
              </>
            ) : (
              <>
                <Badge variant={graded >= 80 ? "secondary" : "destructive"}>
                  {graded}% {graded >= 80 ? "- passed" : "- below 80%"}
                </Badge>
                {graded >= 80 ? (
                  <Button onClick={onClose}>Done</Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnswers({});
                      setGraded(null);
                    }}
                  >
                    Retry
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </p>
      {children}
    </div>
  );
}
