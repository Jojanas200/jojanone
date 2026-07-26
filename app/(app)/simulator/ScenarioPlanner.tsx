"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SCENARIO_DEFS,
  applicableQuestions,
  generateScenarioResult,
  type ScenarioAnswers,
  type ScenarioResult,
} from "@/shared/scenarios/engine";
import type { ScenarioType } from "@/shared/schemas/scenarios";
import { nice } from "../_shared/format";

type ScenarioRun = {
  id: string;
  scenarioType: string;
  scenarioName: string;
  result: Partial<ScenarioResult> & Record<string, unknown>;
  createdAt: string | Date;
};

const impactVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

const MODULE_ROUTES: Record<string, string> = {
  hr: "/hr",
  compliance: "/compliance",
  contracts: "/contracts",
  policies: "/policies",
  gdpr: "/gdpr",
  risk: "/risk",
  governance: "/governance",
  "business-map": "/business-map",
  "investor-ready": "/investor-ready",
  "tender-ready": "/tender-ready",
};

const CATEGORY_ORDER = ["People", "Growth", "Compliance", "Digital", "Finance"];

export function ScenarioPlanner({
  runs,
  canWrite,
}: {
  runs: ScenarioRun[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [wizardType, setWizardType] = useState<ScenarioType | null>(null);
  const [viewing, setViewing] = useState<ScenarioRun | null>(null);

  const groups = useMemo(() => {
    const byCat = new Map<
      string,
      [ScenarioType, (typeof SCENARIO_DEFS)[ScenarioType]][]
    >();
    for (const [key, def] of Object.entries(SCENARIO_DEFS)) {
      const arr = byCat.get(def.category) ?? [];
      arr.push([key as ScenarioType, def]);
      byCat.set(def.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map(
      (c) => [c, byCat.get(c)!] as const,
    );
  }, []);

  async function removeRun(id: string) {
    if (!window.confirm("Delete this saved scenario?")) return;
    const res = await fetch(`/api/simulator/scenarios/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Scenario deleted");
      router.refresh();
    } else toast.error("Could not delete");
  }

  const viewingResult =
    viewing && viewing.result.summary
      ? (viewing.result as ScenarioResult)
      : null;

  return (
    <div className="space-y-6">
      {groups.map(([category, defs]) => (
        <div key={category}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {defs.map(([key, def]) => (
              <Card key={key} className="flex flex-col gap-1.5 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {def.label}
                </p>
                <p className="text-xs text-muted-foreground">{def.tagline}</p>
                {canWrite && (
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setWizardType(key)}
                    >
                      Run scenario
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Saved scenarios ({runs.length})
        </h3>
        {runs.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No scenarios yet. Run one above to see readiness, risks and the
            actions to take.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {runs.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.scenarioName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SCENARIO_DEFS[r.scenarioType as ScenarioType]?.label ??
                        nice(r.scenarioType)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {r.result.impact && (
                      <Badge variant={impactVariant[r.result.impact]}>
                        {r.result.impact} impact
                      </Badge>
                    )}
                    <Badge variant="outline">{r.result.readiness ?? 0}%</Badge>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {r.result.summary ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setViewing(r)}
                    >
                      View result
                    </Button>
                  ) : (
                    (r.result.outstanding ?? []).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Still to do: {(r.result.outstanding ?? []).join("; ")}
                      </p>
                    )
                  )}
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => removeRun(r.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {wizardType && (
        <ScenarioWizard
          type={wizardType}
          onClose={() => setWizardType(null)}
          onSaved={() => router.refresh()}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewing && viewingResult && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.scenarioName}</DialogTitle>
                <DialogDescription>
                  {SCENARIO_DEFS[viewing.scenarioType as ScenarioType]?.label ??
                    nice(viewing.scenarioType)}
                </DialogDescription>
              </DialogHeader>
              <ResultPanel result={viewingResult} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScenarioWizard({
  type,
  onClose,
  onSaved,
}: {
  type: ScenarioType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const def = SCENARIO_DEFS[type];
  const [answers, setAnswers] = useState<ScenarioAnswers>({});
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"questions" | "review" | "result">(
    "questions",
  );
  const [name, setName] = useState(def.label);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const questions = applicableQuestions(type, answers);
  const q = questions[Math.min(step, questions.length - 1)];
  const answered = answers[q?.key ?? ""] !== undefined;
  const canAdvance = q && (!q.required || answered);

  function set(v: string | number | boolean) {
    setAnswers((p) => ({ ...p, [q.key]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/simulator/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioType: type,
          scenarioName: name.trim() || def.label,
          answers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setResult(generateScenarioResult(type, answers));
      setPhase("result");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{def.label}</DialogTitle>
          <DialogDescription>{def.tagline}</DialogDescription>
        </DialogHeader>

        {phase === "questions" && q && (
          <div>
            <div className="mb-2 text-xs text-muted-foreground">
              Question {Math.min(step + 1, questions.length)} of{" "}
              {questions.length}
            </div>
            <Progress
              value={((step + 1) / questions.length) * 100}
              className="mb-5"
            />
            <p className="text-base font-medium text-foreground">{q.label}</p>
            {q.hint && (
              <p className="mt-1 text-xs text-muted-foreground">{q.hint}</p>
            )}
            <div className="mt-4">
              {q.type === "boolean" ? (
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <Button
                      key={String(v)}
                      variant={answers[q.key] === v ? "default" : "outline"}
                      onClick={() => set(v)}
                    >
                      {v ? "Yes" : "No"}
                    </Button>
                  ))}
                </div>
              ) : q.type === "select" ? (
                <Select
                  value={(answers[q.key] as string) ?? ""}
                  onValueChange={(v) => set(v)}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(q.options ?? []).map((o) => (
                      <SelectItem key={o} value={o} className="capitalize">
                        {nice(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={
                    q.type === "number"
                      ? "number"
                      : q.type === "date"
                        ? "date"
                        : "text"
                  }
                  value={
                    answers[q.key] === undefined ? "" : String(answers[q.key])
                  }
                  onChange={(e) =>
                    set(
                      q.type === "number"
                        ? Number(e.target.value) || 0
                        : e.target.value,
                    )
                  }
                />
              )}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
              {step < questions.length - 1 ? (
                <Button
                  disabled={!canAdvance}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  disabled={!canAdvance}
                  onClick={() => setPhase("review")}
                >
                  Review
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="run-name">Scenario name</Label>
              <Input
                id="run-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border">
              {questions.map((qq) => (
                <div
                  key={qq.key}
                  className="flex items-start justify-between gap-4 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground">{qq.label}</span>
                  <span className="text-right font-medium text-foreground">
                    {answers[qq.key] === undefined
                      ? "-"
                      : typeof answers[qq.key] === "boolean"
                        ? answers[qq.key]
                          ? "Yes"
                          : "No"
                        : nice(String(answers[qq.key]))}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setPhase("questions")}>
                Back
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Running…" : "Run scenario"}
              </Button>
            </div>
          </div>
        )}

        {phase === "result" && result && (
          <>
            <ResultPanel result={result} />
            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultPanel({ result: r }: { result: ScenarioResult }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={impactVariant[r.impact]}>{r.impact} impact</Badge>
        <Badge variant={r.readiness >= 80 ? "secondary" : "outline"}>
          {r.readiness}% ready ({r.handled}/{r.total} handled)
        </Badge>
      </div>
      <p className="text-foreground">{r.summary}</p>

      {r.affectedModules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.affectedModules.map((m) => (
            <Link
              key={m}
              href={MODULE_ROUTES[m] ?? "/dashboard"}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground hover:text-foreground"
            >
              {nice(m)}
            </Link>
          ))}
        </div>
      )}

      {r.risks.length > 0 && (
        <Section title="Risks">
          {r.risks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </Section>
      )}
      {r.actions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Required actions
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {r.actions.map((x) => (
              <li key={x.label} className="flex items-start gap-2">
                <Badge
                  variant={x.priority === "high" ? "destructive" : "outline"}
                  className="mt-0.5 shrink-0 capitalize"
                >
                  {x.priority}
                </Badge>
                <span className="text-foreground">
                  {x.label}{" "}
                  <Link
                    href={MODULE_ROUTES[x.module] ?? "/dashboard"}
                    className="text-xs text-primary hover:underline"
                  >
                    Open {nice(x.module)}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.considerations.length > 0 && (
        <Section title="Key considerations">
          {r.considerations.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </Section>
      )}
      {r.documents.length > 0 && (
        <Section title="Recommended documents">
          {r.documents.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </Section>
      )}
      {r.deadlines.length > 0 && (
        <Section title="Deadlines">
          {r.deadlines.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </Section>
      )}
      {r.professionalSupport && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
          {r.professionalSupport}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        A model to structure your thinking - guidance, not advice.
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1.5 list-inside list-disc space-y-1 text-foreground">
        {children}
      </ul>
    </div>
  );
}
