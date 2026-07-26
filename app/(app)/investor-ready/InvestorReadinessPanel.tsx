"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileBarChart, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INVESTOR_ASSESSMENT,
  type AnswerOption,
} from "@/shared/schemas/investor-readiness";

type Assessment = {
  answers: Record<string, unknown>;
  overallScore: number;
  corporateScore: number;
  financialScore: number;
  legalScore: number;
  complianceScore: number;
  commercialScore: number;
  peopleScore: number;
  dataRoomScore: number;
  redFlags: string[];
} | null;

const OPTIONS: AnswerOption[] = ["yes", "partial", "no", "unsure", "na"];
const OPTION_LABEL: Record<AnswerOption, string> = {
  yes: "Yes",
  partial: "Partial",
  no: "No",
  unsure: "Unsure",
  na: "N/A",
};

const bandVariant = (n: number): "secondary" | "outline" | "destructive" =>
  n >= 80 ? "secondary" : n >= 50 ? "outline" : "destructive";
const bandLabel = (n: number) =>
  n >= 80 ? "Investment ready" : n >= 50 ? "Getting there" : "Early";

export function InvestorReadinessPanel({
  assessment,
  canWrite,
}: {
  assessment: Assessment;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const overall = assessment?.overallScore ?? 0;
  const dims = [
    { label: "Corporate structure", score: assessment?.corporateScore ?? 0 },
    { label: "Financial records", score: assessment?.financialScore ?? 0 },
    { label: "Legal and contracts", score: assessment?.legalScore ?? 0 },
    { label: "Compliance and data", score: assessment?.complianceScore ?? 0 },
    { label: "Commercial and market", score: assessment?.commercialScore ?? 0 },
    { label: "People", score: assessment?.peopleScore ?? 0 },
    { label: "Data room", score: assessment?.dataRoomScore ?? 0 },
  ];
  const redFlags = assessment?.redFlags ?? [];
  const hasAssessment = !!assessment;

  async function generateReport() {
    setReporting(true);
    try {
      const res = await fetch("/api/investor/report", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      toast.success("Investor Readiness Report generated");
      router.push(`/reports/${data.report.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Investor readiness</p>
            <p className="text-3xl font-semibold text-foreground">{overall}%</p>
            {!hasAssessment && (
              <p className="mt-1 text-xs text-muted-foreground">
                Run the assessment to score your readiness.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={bandVariant(overall)}>{bandLabel(overall)}</Badge>
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardOpen(true)}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Run assessment
              </Button>
            )}
            <Button
              size="sm"
              onClick={generateReport}
              disabled={reporting || !hasAssessment}
            >
              <FileBarChart className="mr-1.5 h-4 w-4" />
              {reporting ? "Generating…" : "Generate report"}
            </Button>
          </div>
        </div>
        <Progress value={overall} className="mt-4" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {dims.map((d) => (
            <div key={d.label} className="rounded-lg border border-border p-2">
              <p className="text-sm font-semibold text-foreground">
                {d.score}%
              </p>
              <p className="text-[11px] text-muted-foreground">{d.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {redFlags.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            Red flags to resolve before raising
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-foreground">
            {redFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        A deterministic self-assessment to help you prepare. Where professional
        judgement is required (structure, valuation, tax reliefs such as
        SEIS/EIS, share issuance), seek qualified support.
      </p>

      {wizardOpen && (
        <AssessmentWizard
          initial={(assessment?.answers ?? {}) as Record<string, string>}
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            setWizardOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AssessmentWizard({
  initial,
  onClose,
  onSaved,
}: {
  initial: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);

  const total = INVESTOR_ASSESSMENT.length;
  const done = step === total;
  const current = INVESTOR_ASSESSMENT[step];
  const progress = Math.round(((done ? total : step) / total) * 100);
  const stepComplete =
    !current || current.questions.every((q) => answers[q.id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/investor/readiness", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Assessment saved");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Investor readiness assessment</DialogTitle>
          <DialogDescription>
            {done
              ? "Review your answers, then save to score your readiness."
              : `${current.label} - step ${step + 1} of ${total}`}
          </DialogDescription>
        </DialogHeader>
        <Progress value={progress} className="h-1.5" />

        {done ? (
          <ul className="max-h-[320px] space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-xs">
            {INVESTOR_ASSESSMENT.flatMap((s) => s.questions).map((q) => (
              <li key={q.id}>
                <span className="text-muted-foreground">{q.text}</span>{" "}
                <strong className="text-foreground">
                  {answers[q.id]
                    ? OPTION_LABEL[answers[q.id] as AnswerOption]
                    : "unanswered"}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            {current.questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{q.text}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {OPTIONS.map((opt) => (
                    <Button
                      key={opt}
                      size="sm"
                      variant={answers[q.id] === opt ? "default" : "outline"}
                      className="h-7"
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                    >
                      {OPTION_LABEL[opt]}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {step > 0 && !done && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {!done && (
            <Button disabled={!stepComplete} onClick={() => setStep(step + 1)}>
              {step === total - 1 ? "Review" : "Next"}
            </Button>
          )}
          {done && (
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save assessment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
