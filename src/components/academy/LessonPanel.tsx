import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Printer,
  Info,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/core/StatusPill";
import { LearnRenderer } from "./LearnRenderer";
import {
  type Course,
  type LessonCheckQuestion,
  type LessonScenarioOption,
} from "@/data/academy-catalog";
import { completeLesson } from "@/data/store";
import type { LearnerId } from "@/data/types";

type SectionKey = "objective" | "learn" | "example" | "scenario" | "action" | "check" | "recap";
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "objective", label: "Objective" },
  { key: "learn", label: "Learn" },
  { key: "example", label: "Example" },
  { key: "scenario", label: "Apply" },
  { key: "action", label: "Action" },
  { key: "check", label: "Check" },
  { key: "recap", label: "Recap" },
];

export function LessonPanel({
  course,
  lessonIndex,
  learnerId,
  alreadyCompleted,
  onExit,
  onPrev,
  onNext,
  onTakeQuiz,
  onAskJova,
  onPrintResource,
}: {
  course: Course;
  lessonIndex: number;
  learnerId: LearnerId;
  alreadyCompleted: boolean;
  onExit: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTakeQuiz: () => void;
  onAskJova: (question: string, refType?: string, refId?: string) => void;
  onPrintResource: () => void;
}) {
  const lesson = course.lessons[lessonIndex] ?? course.lessons[0];
  const navigate = useNavigate();

  // A completed lesson does not need the check re-passed.
  const [checkPassed, setCheckPassed] = useState(alreadyCompleted);
  const [savedTick, setSavedTick] = useState(false);
  useEffect(() => {
    setCheckPassed(alreadyCompleted);
  }, [lesson.id, alreadyCompleted]);

  const [active, setActive] = useState<SectionKey>("learn");
  useEffect(() => {
    setActive("learn");
  }, [lesson.id]);

  const flashSaved = () => {
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  const handleCheckPassed = () => {
    if (!alreadyCompleted) {
      completeLesson(learnerId, course.id, lesson.id);
      flashSaved();
      toast.success("Lesson complete - progress saved");
    }
    setCheckPassed(true);
    setActive("recap");
  };

  const canGoNext = checkPassed || alreadyCompleted;
  const isLast = lessonIndex >= course.lessons.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>
          Lesson {lessonIndex + 1} of {course.lessons.length}
          {alreadyCompleted && (
            <span className="ml-2 text-[oklch(0.55_0.15_148)]">· previously completed</span>
          )}
        </span>
        <button type="button" className="hover:text-foreground" onClick={onExit}>
          Back to course
        </button>
      </div>
      <Progress value={((lessonIndex + 1) / course.lessons.length) * 100} className="h-1.5" />

      <h3 className="text-[16px] font-semibold text-foreground">{lesson.title}</h3>

      {/* Section navigation */}
      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-1">
        {SECTIONS.map((s) => {
          const done =
            (s.key === "check" && checkPassed) ||
            (s.key === "recap" && checkPassed) ||
            (["objective", "learn", "example", "scenario", "action"].includes(s.key) && checkPassed);
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={
                "rounded px-2 py-1 text-[11px] font-medium transition-colors " +
                (isActive
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "text-[oklch(0.35_0.15_148)] hover:bg-background"
                    : "text-muted-foreground hover:bg-background hover:text-foreground")
              }
            >
              {s.label}
              {done && !isActive && <CheckCircle2 className="ml-1 inline h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {active === "objective" && (
        <SectionShell heading="Learning objective">
          <p className="text-[14px] text-foreground">{lesson.objective}</p>
        </SectionShell>
      )}

      {active === "learn" && (
        <SectionShell heading="Learn">
          <LearnRenderer content={lesson.learn} />
        </SectionShell>
      )}

      {active === "example" && (
        <SectionShell heading="Business example" icon={<Lightbulb className="h-4 w-4 text-primary" />}>
          <p className="text-[12px] uppercase tracking-wider text-muted-foreground">{lesson.example.business}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">{lesson.example.body}</p>
          <p className="mt-2 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-2 py-1.5 text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground">Why it matters - </span>
            {lesson.example.why}
          </p>
        </SectionShell>
      )}

      {active === "scenario" && (
        <SectionShell heading="Apply your learning">
          <ScenarioBlock lesson={lesson} onDone={() => setActive("action")} />
        </SectionShell>
      )}

      {active === "action" && (
        <SectionShell heading="Practical action">
          <p className="text-[14px] font-semibold text-foreground">{lesson.action.title}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{lesson.action.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lesson.action.route && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigate({ to: lesson.action.route!, search: (lesson.action.routeSearch ?? {}) as never });
                }}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open module
              </Button>
            )}
            {lesson.action.ask_jova && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  onAskJova(
                    lesson.action.ask_jova!,
                    "academy_lesson",
                    `${course.id}::${lesson.id}::explain_simply`,
                  )
                }
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onPrintResource}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print course resource
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Actions do not automatically change or complete a business record. You confirm any change inside the linked module.
          </p>
        </SectionShell>
      )}

      {active === "check" && (
        <SectionShell heading="Knowledge check">
          <CheckBlock
            questions={lesson.checks}
            alreadyPassed={checkPassed}
            onAllCorrect={handleCheckPassed}
          />
        </SectionShell>
      )}

      {active === "recap" && (
        <SectionShell heading="Key takeaways">
          <ul className="ml-5 list-disc space-y-1 text-[14px] text-foreground">
            {lesson.recap.takeaways.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-3 text-[13px]">
            <span className="font-semibold text-foreground">Common mistake - </span>
            <span className="text-muted-foreground">{lesson.recap.common_mistake}</span>
          </p>
          {lesson.recap.professional_support && (
            <p className="mt-2 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-2 py-1.5 text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">Professional support - </span>
              {lesson.recap.professional_support}
            </p>
          )}
          {lesson.recap.next_preview && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">Next - </span>
              {lesson.recap.next_preview}
            </p>
          )}
        </SectionShell>
      )}

      {/* Ask Jova global on lesson */}
      <div className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3 text-[12px]">
        <p className="text-muted-foreground">
          Ask Jova about this lesson - a simpler explanation, another example, or which Jojan One record it links to.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskJova(
                `Explain the lesson "${lesson.title}" (from "${course.title}") in simpler language.`,
                "academy_lesson",
                `${course.id}::${lesson.id}::explain_simply`,
              )
            }
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Explain simply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskJova(
                `Give me another fictional example for the lesson "${lesson.title}" (from "${course.title}").`,
                "academy_lesson",
                `${course.id}::${lesson.id}::another_example`,
              )
            }
          >
            Another example
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskJova(
                `Which Jojan One record relates to the lesson "${lesson.title}" (from "${course.title}")?`,
                "academy_lesson",
                `${course.id}::${lesson.id}::related_record`,
              )
            }
          >
            Related record
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskJova(
                `Summarise the lesson "${lesson.title}" from "${course.title}".`,
                "academy_lesson",
                `${course.id}::${lesson.id}::summarise_lesson`,
              )
            }
          >
            Summarise lesson
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={lessonIndex === 0} onClick={onPrev}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Previous
        </Button>
        {!checkPassed && !alreadyCompleted && (
          <Button
            size="sm"
            variant={active === "check" ? "default" : "outline"}
            onClick={() => setActive("check")}
          >
            Take knowledge check
          </Button>
        )}
        {isLast ? (
          <Button size="sm" disabled={!canGoNext} onClick={onTakeQuiz}>
            Take final quiz
          </Button>
        ) : (
          <Button size="sm" disabled={!canGoNext} onClick={onNext}>
            Next <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
        {savedTick && <StatusPill tone="success">Saved</StatusPill>}
        {!canGoNext && (
          <span className="text-[11px] text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3" />
            Pass the knowledge check to continue
          </span>
        )}
      </div>
    </div>
  );
}

function SectionShell({ heading, icon, children }: { heading: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {heading}
      </p>
      {children}
    </div>
  );
}

function ScenarioBlock({ lesson, onDone }: { lesson: Course["lessons"][number]; onDone: () => void }) {
  const scenario = lesson.scenario;
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = picked ? scenario.options.find((o) => o.id === picked) : null;
  return (
    <div>
      <p className="text-[14px] font-medium text-foreground">{scenario.prompt}</p>
      <div className="mt-3 space-y-2">
        {scenario.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setPicked(o.id)}
            className={
              "block w-full rounded-md border px-3 py-2 text-left text-[13px] transition-colors " +
              (picked === o.id
                ? "border-primary bg-[oklch(0.97_0.02_260)]"
                : "border-border hover:bg-accent")
            }
          >
            <span className="font-medium text-foreground">{o.label}</span>
          </button>
        ))}
      </div>
      {chosen && (
        <div className="mt-3 space-y-2">
          <div
            className={
              "rounded-md border p-3 text-[13px] " +
              (chosen.strength === "best"
                ? "border-[oklch(0.85_0.06_148)] bg-[oklch(0.97_0.03_148)]"
                : chosen.strength === "acceptable"
                  ? "border-border bg-[oklch(0.98_0.003_260)]"
                  : chosen.strength === "risky"
                    ? "border-[oklch(0.85_0.09_75)] bg-[oklch(0.98_0.04_75)]"
                    : "border-[oklch(0.85_0.08_25)] bg-[oklch(0.98_0.03_25)]")
            }
          >
            <StrengthLabel strength={chosen.strength} />
            <p className="mt-1 text-foreground">{chosen.feedback}</p>
          </div>
          {chosen.strength !== "best" && (
            <p className="text-[12px] text-muted-foreground">
              The strongest option was <span className="font-medium">"{scenario.options.find((o) => o.strength === "best")?.label}"</span>. More than one option can sometimes be reasonable - this scenario picks the strongest.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={onDone}>Continue</Button>
        </div>
      )}
    </div>
  );
}

function StrengthLabel({ strength }: { strength: LessonScenarioOption["strength"] }) {
  const tone = strength === "best" ? "success" : strength === "risky" ? "warning" : strength === "wrong" ? "danger" : "info";
  const label = strength === "best" ? "Strongest choice" : strength === "acceptable" ? "Reasonable" : strength === "risky" ? "Creates risk" : "Not recommended";
  return <StatusPill tone={tone as never}>{label}</StatusPill>;
}

function CheckBlock({
  questions,
  alreadyPassed,
  onAllCorrect,
}: {
  questions: LessonCheckQuestion[];
  alreadyPassed: boolean;
  onAllCorrect: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (alreadyPassed) setSubmitted(true);
  }, [alreadyPassed]);

  const graded = useMemo(() => {
    return questions.map((q) => {
      const picked = answers[q.id] ?? [];
      const correct = q.correct.slice().sort().join(",");
      const chosen = picked.slice().sort().join(",");
      return { q, picked, isCorrect: correct === chosen };
    });
  }, [answers, questions]);

  const allAnswered = questions.every((q) => (answers[q.id] ?? []).length > 0);
  const allCorrect = graded.every((g) => g.isCorrect);

  const toggle = (q: LessonCheckQuestion, i: number) => {
    setAnswers((prev) => {
      const current = prev[q.id] ?? [];
      if (q.kind === "multi") {
        return {
          ...prev,
          [q.id]: current.includes(i) ? current.filter((x) => x !== i) : [...current, i],
        };
      }
      return { ...prev, [q.id]: [i] };
    });
  };

  const submit = () => {
    setSubmitted(true);
    if (allCorrect) onAllCorrect();
  };

  const retry = () => {
    setSubmitted(false);
    setAnswers({});
  };

  return (
    <div className="space-y-4">
      {alreadyPassed && (
        <p className="rounded-md border border-border bg-[oklch(0.97_0.03_148)] px-3 py-2 text-[12px] text-foreground">
          You've already completed this lesson - the check is optional to review.
        </p>
      )}
      {questions.map((q, qi) => {
        const g = graded[qi];
        const picked = answers[q.id] ?? [];
        return (
          <div key={q.id}>
            <p className="text-[13px] font-medium text-foreground">
              {qi + 1}. {q.question}{" "}
              {q.kind === "multi" && (
                <span className="text-[11px] text-muted-foreground">(select all that apply)</span>
              )}
            </p>
            <div className="mt-1 space-y-1">
              {q.options.map((opt, oi) => {
                const selected = picked.includes(oi);
                const isCorrectOpt = q.correct.includes(oi);
                const showResult = submitted;
                return (
                  <label
                    key={oi}
                    className={
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors " +
                      (showResult && isCorrectOpt
                        ? "border-[oklch(0.75_0.12_148)] bg-[oklch(0.97_0.03_148)]"
                        : showResult && selected && !isCorrectOpt
                          ? "border-[oklch(0.80_0.10_25)] bg-[oklch(0.98_0.03_25)]"
                          : "border-border")
                    }
                  >
                    <input
                      type={q.kind === "multi" ? "checkbox" : "radio"}
                      name={q.id}
                      className="mt-1"
                      checked={selected}
                      onChange={() => toggle(q, oi)}
                      disabled={submitted && g.isCorrect}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {submitted && (
              <p
                className={
                  "mt-1 text-[12px] " +
                  (g.isCorrect ? "text-[oklch(0.45_0.15_148)]" : "text-[oklch(0.50_0.15_25)]")
                }
              >
                {g.isCorrect ? "Correct - " : "Not quite - "}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        {!submitted && (
          <Button size="sm" disabled={!allAnswered} onClick={submit}>
            Check answers
          </Button>
        )}
        {submitted && !allCorrect && (
          <Button size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
        {submitted && allCorrect && (
          <StatusPill tone="success">All correct - lesson complete</StatusPill>
        )}
      </div>
    </div>
  );
}