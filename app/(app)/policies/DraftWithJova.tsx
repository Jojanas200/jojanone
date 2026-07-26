"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  POLICY_TEMPLATES,
  getPolicyTemplate,
  questionsFor,
} from "@/shared/policies/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Templates grouped by category for the picker.
const GROUPS = (() => {
  const map = new Map<string, typeof POLICY_TEMPLATES>();
  for (const t of POLICY_TEMPLATES) {
    const arr = map.get(t.category) ?? [];
    arr.push(t);
    map.set(t.category, arr);
  }
  return Array.from(map.entries());
})();

export function DraftWithJova({
  open: controlledOpen,
  onOpenChange,
  initialTemplateKey = null,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  initialTemplateKey?: string | null;
  showTrigger?: boolean;
} = {}) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const [step, setStep] = useState<"pick" | "questions">("pick");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [policyName, setPolicyName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const template = getPolicyTemplate(templateKey);
  const questions = useMemo(() => questionsFor(templateKey), [templateKey]);

  function reset() {
    setStep("pick");
    setTemplateKey(null);
    setPolicyName("");
    setAnswers({});
  }

  function setOpen(v: boolean) {
    if (!isControlled) setUncontrolledOpen(v);
    onOpenChange?.(v);
    if (!v) reset();
  }

  function choose(key: string | null) {
    setTemplateKey(key);
    const t = getPolicyTemplate(key);
    setPolicyName(t?.title ?? "");
    setAnswers({});
    setStep("questions");
  }

  // When opened to a specific template (from the library), jump straight to its
  // guided questions; a plain open lands on the template picker.
  useEffect(() => {
    if (!open) return;
    if (initialTemplateKey) choose(initialTemplateKey);
    else setStep("pick");
  }, [open, initialTemplateKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!policyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/policies/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: templateKey ?? undefined,
          policyName: policyName.trim(),
          policyCategory: template?.category ?? undefined,
          answers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      toast.success("Jova drafted your policy");
      setOpen(false);
      reset();
      router.push(`/policies/${data.policy.id}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Sparkles className="mr-1.5 h-4 w-4" />
            Draft with Jova
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {step === "pick" ? (
          <>
            <DialogHeader>
              <DialogTitle>Draft a policy with Jova</DialogTitle>
              <DialogDescription>
                Pick a template to start from. Jova asks a few guided questions,
                then writes a first draft grounded in your business.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {GROUPS.map(([category, templates]) => (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {templates.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => choose(t.key)}
                        className="rounded-xl border border-border p-3 text-left transition hover:border-foreground/30 hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {t.title}
                          </span>
                          {t.requiresAcknowledgement && (
                            <Badge variant="outline" className="shrink-0">
                              sign-off
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => choose(null)}
                className="w-full rounded-xl border border-dashed border-border p-3 text-left text-sm text-muted-foreground transition hover:border-foreground/30"
              >
                <span className="font-medium text-foreground">
                  Blank policy
                </span>{" "}
                - start from scratch with the standard questions.
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("pick")}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Back to templates"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {template ? template.title : "New policy"}
              </DialogTitle>
              <DialogDescription>
                Answer what you can - leave the rest and Jova will write
                sensible defaults. It saves as a draft for you to review and
                adopt.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="draftName">Policy name</Label>
                <Input
                  id="draftName"
                  required
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  placeholder="Data Protection Policy"
                />
              </div>

              {questions.map((q) => {
                const val = answers[q.key] ?? "";
                const setVal = (v: string) =>
                  setAnswers((p) => ({ ...p, [q.key]: v }));
                const placeholder =
                  q.key === "purpose"
                    ? (template?.defaultPurpose ?? "")
                    : (q.hint ?? "");
                return (
                  <div key={q.key} className="space-y-1.5">
                    <Label className="flex items-center gap-2">
                      {q.question}
                      {q.optional && (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          optional
                        </span>
                      )}
                    </Label>
                    {q.answerType === "long" ? (
                      <Textarea
                        value={val}
                        rows={3}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={placeholder}
                      />
                    ) : (
                      <Input
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={placeholder}
                      />
                    )}
                    {q.hint && q.key !== "purpose" && (
                      <p className="text-[11px] text-muted-foreground">
                        {q.hint}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("pick")}
              >
                Back
              </Button>
              <Button type="submit" disabled={loading || !policyName.trim()}>
                {loading ? "Drafting…" : "Draft with Jova"}
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Guidance grounded in your business data, not legal advice. Have
              material policies reviewed by a qualified professional.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
