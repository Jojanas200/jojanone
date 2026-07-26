"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  GDPR_CHECKLIST,
  type GdprAnswer,
  type GdprRecommendation,
} from "@/shared/schemas/gdpr-registers";
import { fmtDate } from "../_shared/format";

type Assessment = {
  answers: Record<string, unknown>;
  score: number;
  status: string;
  gaps: string[];
  recommendations: GdprRecommendation[];
  completedAt: string | Date | null;
} | null;

const bandOf = (n: number) =>
  n >= 80 ? "Strong" : n >= 50 ? "Developing" : "At risk";
const bandVariantOf = (n: number): "secondary" | "outline" | "destructive" =>
  n >= 80 ? "secondary" : n >= 50 ? "outline" : "destructive";

// Legacy assessments stored booleans; the wizard now stores yes/no/unsure.
function normaliseAnswer(v: unknown): GdprAnswer | undefined {
  if (v === true || v === "yes") return "yes";
  if (v === "unsure") return "unsure";
  if (v === false || v === "no") return "no";
  return undefined;
}
function answersFrom(assessment: Assessment): Record<string, GdprAnswer> {
  const src = (assessment?.answers ?? {}) as Record<string, unknown>;
  const out: Record<string, GdprAnswer> = {};
  for (const q of GDPR_CHECKLIST) {
    const n = normaliseAnswer(src[q.key]);
    if (n) out[q.key] = n;
  }
  return out;
}

const OPTIONS: GdprAnswer[] = ["yes", "no", "unsure"];

export function GdprAssessmentPanel({
  assessment,
  canWrite,
}: {
  assessment: Assessment;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, GdprAnswer>>(() =>
    answersFrom(assessment),
  );
  const [saving, setSaving] = useState(false);

  const score = assessment?.score ?? 0;

  function start() {
    setAnswers(answersFrom(assessment));
    setStep(0);
    setRunning(true);
  }

  async function persist() {
    setSaving(true);
    try {
      const res = await fetch("/api/gdpr/assessment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Health check saved");
      setRunning(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // --- Wizard --------------------------------------------------------------
  if (running) {
    const total = GDPR_CHECKLIST.length;
    const q = GDPR_CHECKLIST[step];
    const answered = GDPR_CHECKLIST.filter((x) => answers[x.key]).length;
    const isLast = step === total - 1;
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {step + 1} of {total} · {answered} answered
          </span>
          <Button size="sm" variant="ghost" onClick={persist} disabled={saving}>
            Save &amp; exit
          </Button>
        </div>
        <Progress value={((step + 1) / total) * 100} className="mt-3" />

        <p className="mt-6 text-base font-medium text-foreground">{q.label}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {OPTIONS.map((v) => (
            <Button
              key={v}
              variant={answers[q.key] === v ? "default" : "outline"}
              className="capitalize"
              onClick={() => setAnswers((p) => ({ ...p, [q.key]: v }))}
            >
              {v}
            </Button>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          {isLast ? (
            <Button disabled={!answers[q.key] || saving} onClick={persist}>
              {saving ? "Saving…" : "Complete"}
            </Button>
          ) : (
            <Button
              disabled={!answers[q.key]}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // --- Summary of the latest saved health check ----------------------------
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Latest GDPR health check
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {score}
              <span className="text-lg text-muted-foreground">/100</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {assessment?.completedAt
                ? `${assessment.status} · completed ${fmtDate(assessment.completedAt)}`
                : "Not yet assessed. Run the health check to get your score."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={bandVariantOf(score)}>{bandOf(score)}</Badge>
            {canWrite && (
              <Button size="sm" onClick={start}>
                <ClipboardCheck className="mr-1.5 h-4 w-4" />
                {assessment ? "Run new assessment" : "Run assessment"}
              </Button>
            )}
          </div>
        </div>
        <Progress value={score} className="mt-4" />

        {assessment && assessment.gaps.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gaps
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {assessment.gaps.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {assessment && assessment.recommendations.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recommendations
            </p>
            <ul className="mt-2 space-y-2 text-sm text-foreground">
              {assessment.recommendations.map((r) => (
                <li key={r.label} className="flex items-start gap-2">
                  <Badge
                    variant={r.priority === "high" ? "destructive" : "outline"}
                    className="mt-0.5 shrink-0 capitalize"
                  >
                    {r.priority}
                  </Badge>
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {!canWrite && (
        <p className="text-xs text-muted-foreground">
          You have read-only access, so you cannot run the health check.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        A self-assessment to help you spot gaps - guidance, not a formal audit
        or legal advice.
      </p>
    </div>
  );
}
