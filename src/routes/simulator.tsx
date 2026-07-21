import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useCoreData,
  saveScenarioRun,
  archiveScenario,
  deleteScenario,
  duplicateScenario,
  newScenarioId,
  newContractDraft,
  upsertContract,
  newEmployeeDraft,
  upsertEmployee,
  upsertEntity,
  newEntityDraft,
  createConversation,
  appendMessage,
  pushNotification,
  upsertHrAction,
  newHrActionDraft,
} from "@/data/store";
import { SCENARIOS, scenarioByType, type ScenarioDefinition } from "@/data/scenarios";
import type { ScenarioRun, ScenarioType, ScenarioResult, ModuleKey } from "@/data/types";
import { formatDate, formatRelative } from "@/data/selectors";
import {
  Button,
  Card,
  Field,
  Input,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  disclaimerScenario,
} from "@/components/business/shared";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  SlidersHorizontal,
  ArrowRight,
  Plus,
  MessageSquare,
  Play,
  Copy,
  Archive,
  Trash2,
  Sparkles,
  Check,
  ArrowLeft,
  AlertTriangle,
  Info,
} from "lucide-react";
import { MODULES } from "@/config/modules.config";
import { toast } from "sonner";

export const Route = createFileRoute("/simulator")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    s: typeof s.s === "string" ? s.s : undefined,
    new: typeof s.new === "string" ? (s.new as ScenarioType) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Simulator - Jojan One" },
      { name: "description", content: "Explore how a business decision may affect your responsibilities, risks and next actions." },
    ],
  }),
  component: SimulatorPage,
});

function readinessTone(r: ScenarioResult["readiness"]): Tone {
  if (r === "ready") return "success";
  if (r === "mostly_ready") return "info";
  if (r === "gaps") return "warning";
  return "danger";
}

function impactTone(l: ScenarioResult["impact_level"]): Tone {
  return l === "high" ? "danger" : l === "medium" ? "warning" : "info";
}

function SimulatorPage() {
  const state = useCoreData((s) => s);
  const { s: openId, new: newType } = Route.useSearch();
  const navigate = useNavigate();
  const [runningType, setRunningType] = useState<ScenarioType | null>(newType ?? null);
  const [openRunId, setOpenRunId] = useState<string | null>(openId ?? null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const runs = state.scenario_runs;
  const openRun = runs.find((r) => r.id === openRunId) ?? null;

  const grouped = useMemo(() => {
    const map = new Map<string, ScenarioDefinition[]>();
    SCENARIOS.forEach((s) => {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <SlidersHorizontal className="h-6 w-6 text-primary" /> Scenario Simulator
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Explore how a business decision may affect your responsibilities, risks and next actions.
          </p>
        </div>
        <Button onClick={() => setRunningType("hire_employee")}>
          <Plus className="mr-1.5 h-4 w-4" /> Start a new scenario
        </Button>
      </div>

      {runs.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Saved simulations" description="Reopen, duplicate or delete previous runs." />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {runs.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3 border border-border bg-card p-5 shadow-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">{r.scenario_name}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {scenarioByType(r.scenario_type).title} · {formatRelative(r.updated_at)}
                    </p>
                  </div>
                  <StatusPill tone={readinessTone(r.result.readiness)}>{r.result.readiness.replace("_", " ")}</StatusPill>
                </div>
                <p className="text-[13px] text-foreground">{r.result.summary}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpenRunId(r.id)}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const id = duplicateScenario(r.id);
                      if (id) {
                        toast.success("Scenario duplicated");
                        setOpenRunId(id);
                      }
                    }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      archiveScenario(r.id);
                      toast.success("Scenario archived");
                    }}
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(r.id)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <SectionHeader title="Scenario categories" description="Pick a decision to model." />
        {grouped.map(([cat, scns]) => (
          <div key={cat} className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {scns.map((s) => (
                <Card key={s.type} className="flex flex-col gap-3 border border-border bg-card p-5 shadow-none">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-foreground">{s.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{s.tagline}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => setRunningType(s.type)}>
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Run scenario
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3 text-[12px] text-muted-foreground">
        <Info className="mr-1 inline h-3.5 w-3.5" /> {disclaimerScenario}
      </p>

      {runningType && (
        <QuestionnaireDialog
          type={runningType}
          onCancel={() => setRunningType(null)}
          onFinish={(run) => {
            saveScenarioRun(run);
            setRunningType(null);
            setOpenRunId(run.id);
            toast.success("Scenario saved");
          }}
        />
      )}

      <DetailDrawer
        open={!!openRun}
        onOpenChange={(v) => !v && setOpenRunId(null)}
        title={openRun?.scenario_name ?? ""}
      >
        {openRun && (
          <ScenarioResultPanel
            run={openRun}
            onNavigate={(to, search) => {
              setOpenRunId(null);
              navigate({ to: to as never, search: search as never });
            }}
          />
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete this scenario?"
        description="This cannot be undone."
        destructive
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) {
            deleteScenario(confirmDelete);
            toast.success("Scenario deleted");
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
}

function QuestionnaireDialog({
  type,
  onCancel,
  onFinish,
}: {
  type: ScenarioType;
  onCancel: () => void;
  onFinish: (run: ScenarioRun) => void;
}) {
  const scenario = scenarioByType(type);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const questions = scenario.questions.filter((q) => (q.showIf ? q.showIf(answers) : true));
  const current = questions[step];
  const isLast = step === questions.length - 1;

  const validateCurrent = () => {
    if (!current.required) return true;
    const v = answers[current.key];
    if (v === undefined || v === "" || v === null) {
      setErrors({ [current.key]: "This field is required." });
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!validateCurrent()) return;
    if (isLast) setReviewing(true);
    else setStep((s) => s + 1);
  };

  const generate = () => {
    const result = scenario.generate(answers);
    const now = new Date().toISOString();
    const namePart =
      (answers.role as string) ||
      (answers.customer_name as string) ||
      (answers.supplier_name as string) ||
      (answers.site_name as string) ||
      (answers.buyer as string) ||
      (answers.tool as string) ||
      "New scenario";
    onFinish({
      id: newScenarioId(),
      business_id: "biz_anastasia",
      scenario_type: type,
      scenario_name: `${scenario.title} - ${namePart}`,
      answers,
      result,
      status: "saved",
      created_at: now,
      updated_at: now,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && setConfirmCancel(true)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{scenario.title}</DialogTitle>
        </DialogHeader>
        <div className="text-[12px] text-muted-foreground">
          Step {reviewing ? questions.length : step + 1} of {questions.length}
        </div>
        <div className="h-1 rounded-full bg-border">
          <div
            className="h-1 rounded-full bg-primary transition-all"
            style={{ width: `${((reviewing ? questions.length : step + 1) / questions.length) * 100}%` }}
          />
        </div>

        {!reviewing ? (
          <div className="mt-2 space-y-4">
            <Field label={current.label} required={current.required} hint={current.help} error={errors[current.key]}>
              {current.type === "select" ? (
                <Select
                  value={(answers[current.key] as string) ?? ""}
                  onValueChange={(v) => setAnswers((a) => ({ ...a, [current.key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {current.options?.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={current.type === "date" ? "date" : "text"}
                  value={(answers[current.key] as string) ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [current.key]: e.target.value }))}
                />
              )}
            </Field>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-[13px] font-semibold text-foreground">Review your answers</p>
            <dl className="divide-y divide-border rounded-md border border-border">
              {questions.map((q) => (
                <div key={q.key} className="grid grid-cols-2 gap-2 p-2 text-[13px]">
                  <dt className="text-muted-foreground">{q.label}</dt>
                  <dd className="font-medium">{String(answers[q.key] ?? "-")}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <DialogFooter className="mt-4 flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
            Save & exit
          </Button>
          <div className="flex gap-2">
            {(step > 0 || reviewing) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (reviewing ? setReviewing(false) : setStep((s) => s - 1))}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
            )}
            {reviewing ? (
              <Button size="sm" onClick={generate}>
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate result
              </Button>
            ) : (
              <Button size="sm" onClick={next}>
                {isLast ? "Review" : "Next"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Discard this scenario?"
        description="Your answers will not be saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel();
        }}
      />
    </Dialog>
  );
}

function ScenarioResultPanel({
  run,
  onNavigate,
}: {
  run: ScenarioRun;
  onNavigate: (to: string, search?: Record<string, unknown>) => void;
}) {
  const scenario = scenarioByType(run.scenario_type);
  const r = run.result;

  const promoteToEmployee = () => {
    const isContractor = run.scenario_type === "engage_contractor";
    const draft = newEmployeeDraft({
      full_name: (run.answers.role as string) || "New employee",
      job_title: (run.answers.role as string) || "",
      employment_type: isContractor ? "contractor" : "employee",
      start_date: (run.answers.start_date as string) || new Date().toISOString(),
    });
    upsertEmployee(draft);
    if (!run.answers.right_to_work_ready || run.answers.right_to_work_ready === "No") {
      upsertHrAction(
        newHrActionDraft(draft.id, {
          action_type: "right_to_work",
          title: `Complete right-to-work check for ${draft.full_name}`,
          description: "Statutory right-to-work check.",
          priority: "high",
          due_date: draft.start_date,
        }),
      );
    }
    toast.success("Employee record created from scenario");
    onNavigate("/hr", { e: draft.id });
  };

  const promoteToContract = () => {
    const counterparty =
      (run.answers.customer_name as string) ||
      (run.answers.supplier_name as string) ||
      (run.answers.tool as string) ||
      "New counterparty";
    const type =
      run.scenario_type === "new_supplier"
        ? "supplier"
        : run.scenario_type === "new_customer"
        ? "customer"
        : run.scenario_type === "engage_contractor"
        ? "contractor"
        : "other";
    const draft = newContractDraft({
      title: `${counterparty} - ${type} agreement`,
      counterparty,
      contract_type: type as never,
      status: "draft",
    });
    upsertContract(draft);
    toast.success("Contract draft created");
    onNavigate("/contracts", { c: draft.id });
  };

  const promoteToRelationship = () => {
    const name =
      (run.answers.customer_name as string) ||
      (run.answers.supplier_name as string) ||
      "New relationship";
    const type = run.scenario_type === "new_supplier" ? "supplier" : "customer";
    const draft = newEntityDraft(name, type as never);
    draft.relationship = scenario.title;
    upsertEntity(draft);
    toast.success("Relationship added to Business Map");
    onNavigate("/business-map", { e: draft.id });
  };

  const askJova = () => {
    const id = createConversation(`About: ${run.scenario_name}`);
    appendMessage({
      conversation_id: id,
      sender: "user",
      content: `Explain the results of my ${scenario.title.toLowerCase()} scenario.`,
      reference_type: "scenario",
      reference_id: run.id,
      suggested_action: null,
    });
    onNavigate("/jova", { c: id });
  };

  const createActionsFromResults = () => {
    // For each required action assigned to HR/contracts/business-map, create records
    r.required_actions.forEach((a) => {
      pushNotification({
        kind: "priority",
        title: a.label,
        description: `From scenario: ${run.scenario_name}`,
        reference_type: "conversation",
        reference_id: null,
        read: false,
      });
    });
    toast.success("Actions added to notifications");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={readinessTone(r.readiness)}>Readiness: {r.readiness.replace("_", " ")}</StatusPill>
        <StatusPill tone={impactTone(r.impact_level)}>Impact: {r.impact_level}</StatusPill>
      </div>
      <p className="text-[14px] text-foreground">{r.summary}</p>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Affected modules</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {r.affected_modules.map((m) => {
            const mod = MODULES.find((x) => x.key === m);
            return (
              <button
                key={m}
                onClick={() => mod && onNavigate(mod.route)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[12px] hover:bg-accent"
              >
                {mod?.title ?? m}
              </button>
            );
          })}
        </div>
      </div>
      <Block title="Key considerations" items={r.considerations} />
      <Block title="Risks" items={r.risks} tone="warning" />
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Required actions</p>
        <ul className="mt-1.5 space-y-1.5">
          {r.required_actions.map((a, i) => {
            const mod = MODULES.find((x) => x.key === a.module);
            return (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border p-2 text-[13px]">
                <StatusPill tone={a.priority === "high" ? "danger" : a.priority === "medium" ? "warning" : "info"}>{a.priority}</StatusPill>
                <span className="flex-1">{a.label}</span>
                {mod && (
                  <button className="text-[12px] text-primary hover:underline" onClick={() => onNavigate(mod.route)}>
                    Open {mod.title}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <Block title="Recommended documents" items={r.recommended_documents} />
      <Block title="Suggested deadlines" items={r.suggested_deadlines} />
      {r.professional_support.length > 0 && (
        <div className="rounded-md border border-[oklch(0.9_0.06_75)] bg-[oklch(0.98_0.04_85)] p-3 text-[13px] text-foreground">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[oklch(0.45_0.15_75)]">
            <AlertTriangle className="h-3.5 w-3.5" /> Professional support
          </p>
          {r.professional_support.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {(run.scenario_type === "hire_employee" || run.scenario_type === "engage_contractor") && (
          <Button size="sm" onClick={promoteToEmployee}>
            Create employee record
          </Button>
        )}
        {(run.scenario_type === "new_customer" || run.scenario_type === "new_supplier" || run.scenario_type === "engage_contractor") && (
          <>
            <Button size="sm" onClick={promoteToContract}>
              Create contract
            </Button>
            <Button size="sm" variant="outline" onClick={promoteToRelationship}>
              Add to Business Map
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={createActionsFromResults}>
          Create actions
        </Button>
        <Button size="sm" variant="ghost" onClick={askJova}>
          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask Jova
        </Button>
      </div>

      <p className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3 text-[12px] text-muted-foreground">
        <Info className="mr-1 inline h-3.5 w-3.5" /> {disclaimerScenario}
      </p>
      <p className="text-[11px] text-muted-foreground">Generated {formatDate(run.created_at)}.</p>
    </div>
  );
}

function Block({ title, items, tone }: { title: string; items: string[]; tone?: "warning" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-1 text-[13px]">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className={`mt-0.5 h-3.5 w-3.5 ${tone === "warning" ? "text-[oklch(0.6_0.22_25)]" : "text-primary"}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}