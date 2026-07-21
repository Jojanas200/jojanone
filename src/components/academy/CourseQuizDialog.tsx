import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/core/StatusPill";
import { getCourse } from "@/data/academy-catalog";
import type { CourseQuizQuestion } from "@/data/academy-catalog";
import { recordQuizAttempt, useCoreData } from "@/data/store";
import { progressFor } from "@/data/academy-selectors";
import type { LearnerId } from "@/data/types";

function shuffle<T>(arr: T[], seed: number): T[] {
  // deterministic-ish shuffle per attempt using a seeded mulberry32
  const out = arr.slice();
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface ShuffledQ extends CourseQuizQuestion {
  order: number[]; // original option indices in display order
}

export function CourseQuizDialog({
  courseId,
  learnerId,
  onClose,
  onOpenLesson,
}: {
  courseId: string;
  learnerId: LearnerId;
  onClose: () => void;
  onOpenLesson: (index: number) => void;
}) {
  const course = getCourse(courseId);
  const state = useCoreData((s) => s);
  const prog = progressFor(state, learnerId, courseId);
  const allLessonsDone = course ? course.lessons.every((l) => prog?.lessons_completed.includes(l.id)) : false;
  const [seed, setSeed] = useState(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<null | { score: number; passed: boolean; wrong: ShuffledQ[] }>(null);

  const shuffled: ShuffledQ[] = useMemo(() => {
    if (!course) return [];
    const qs = shuffle(course.quiz, seed);
    return qs.map((q, i) => {
      const order = shuffle(
        q.options.map((_, idx) => idx),
        seed + i + 1,
      );
      return { ...q, order };
    });
  }, [course, seed]);

  if (!course) return null;

  const submit = () => {
    if (shuffled.some((q) => answers[q.id] === undefined)) {
      toast.error("Answer every question first");
      return;
    }
    const correctCount = shuffled.filter((q) => answers[q.id] === q.correct_index).length;
    const score = Math.round((correctCount / shuffled.length) * 100);
    const passed = score >= 80;
    const wrong = shuffled.filter((q) => answers[q.id] !== q.correct_index);
    const r = recordQuizAttempt({
      learner_id: learnerId,
      course_id: courseId,
      score,
      passed: passed && allLessonsDone,
      answers,
    });
    setResult({ score, passed, wrong });
    if (passed && !allLessonsDone) {
      toast.warning("Quiz passed, but complete every lesson to earn the certificate.");
    } else if (passed && r.certificate) {
      toast.success(`Certificate ${r.certificate.reference} generated`);
    } else if (!passed) {
      toast.error(`Score ${score}% - 80% needed to pass`);
    }
  };

  const retry = () => {
    setSeed(Date.now());
    setAnswers({});
    setResult(null);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{course.title} - final knowledge check</DialogTitle>
          <DialogDescription>
            {shuffled.length} questions · 80% pass mark · unlimited retries. Question and option order is randomised.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-foreground">Score {result.score}%</p>
              <StatusPill tone={result.passed ? "success" : "warning"}>{result.passed ? "Passed" : "Not passed"}</StatusPill>
            </div>
            {!result.passed && (
              <p className="text-[13px] text-muted-foreground">Review the areas below and try again.</p>
            )}
            {result.wrong.length > 0 && (
              <div className="space-y-2">
                {result.wrong.map((q) => (
                  <div key={q.id} className="rounded-md border border-border p-2 text-[12px]">
                    <p className="font-medium text-foreground">{q.question}</p>
                    <p className="mt-1 text-muted-foreground">
                      Correct answer: <span className="font-medium text-foreground">{q.options[q.correct_index]}</span>
                    </p>
                    {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
                    {q.learning_area && (
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                        Learning area: {q.learning_area}
                      </p>
                    )}
                    {course.lessons.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1"
                        onClick={() => {
                          onOpenLesson(0);
                          onClose();
                        }}
                      >
                        Review lessons
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {result.passed && allLessonsDone && (
              <p className="text-[13px] text-foreground">Certificate has been generated in your Certificates tab.</p>
            )}
            {result.passed && !allLessonsDone && (
              <p className="text-[13px] text-foreground">You still need to complete every lesson to earn the certificate.</p>
            )}
            <DialogFooter>
              {!result.passed && (
                <Button variant="outline" onClick={retry}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
                </Button>
              )}
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {shuffled.map((q, qi) => (
              <div key={q.id}>
                <p className="text-[13px] font-medium text-foreground">
                  {qi + 1}. {q.question}
                  {q.scenario && (
                    <span className="ml-2 rounded bg-[oklch(0.97_0.03_260)] px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      Scenario
                    </span>
                  )}
                </p>
                <div className="mt-1 space-y-1">
                  {q.order.map((oi) => (
                    <label
                      key={oi}
                      className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-[13px]"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        className="mt-1"
                        checked={answers[q.id] === oi}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                      />
                      <span>{q.options[oi]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={submit}>Submit</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}