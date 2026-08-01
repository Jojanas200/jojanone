"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SECTIONS,
  isVisible,
  isRequiredNow,
  missingInitialFields,
  resumeSectionIndex,
} from "@/shared/onboarding/logic";
import type { JsonValue, OnboardingAnswers } from "@/shared/onboarding/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldControl } from "./FieldControl";

export function OnboardingWizard({
  initialAnswers,
}: {
  initialAnswers: OnboardingAnswers;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  // Resume where they stopped: the first section still holding an unanswered
  // required field. A fresh account starts at the beginning.
  const [step, setStep] = useState(() => resumeSectionIndex(initialAnswers));
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const section = SECTIONS[step];
  const isLast = step === SECTIONS.length - 1;

  const missing = useMemo(() => missingInitialFields(answers), [answers]);
  const visibleInSection = section.fields.filter((f) => isVisible(f, answers));

  function setAnswer(id: string, value: JsonValue | undefined) {
    setAnswers((a) => {
      const next = { ...a };
      if (value === undefined || value === "") delete next[id];
      else next[id] = value;
      return next;
    });
  }

  async function persist(): Promise<boolean> {
    const res = await fetch("/api/onboarding/responses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    });
    if (!res.ok) {
      toast.error(
        (await res.json().catch(() => ({})))?.error ?? "Could not save",
      );
      return false;
    }
    const state = (await res.json()) as { answers: OnboardingAnswers };
    setAnswers(state.answers); // reflect server-cleaned answers (secrets/unknowns dropped)
    return true;
  }

  async function goNext() {
    setBusy(true);
    try {
      if (await persist()) setStep((s) => Math.min(s + 1, SECTIONS.length - 1));
    } finally {
      setBusy(false);
    }
  }

  async function saveAndExit() {
    setBusy(true);
    try {
      if (await persist()) {
        // After a successful save the workspace always exists (PATCH provisions
        // it on first save), so the dashboard is reachable.
        toast.success("Saved. You can finish setup anytime.");
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      if (!(await persist())) return;
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (res.ok) {
        toast.success("You’re all set up!");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        missing?: string[];
      };
      setShowErrors(true);
      const firstMissing = body.missing?.[0];
      if (firstMissing) {
        const idx = SECTIONS.findIndex((s) =>
          s.fields.some((f) => f.id === firstMissing),
        );
        if (idx >= 0) setStep(idx);
      }
      toast.error(
        `${body.missing?.length ?? "Some"} required item${
          body.missing?.length === 1 ? "" : "s"
        } still needed.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {SECTIONS.length} · {section.title}
          </span>
          <span>
            {missing.length === 0
              ? "All required items complete"
              : `${missing.length} required item${missing.length === 1 ? "" : "s"} left`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / SECTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">
            {section.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {section.summary}
          </p>
        </div>

        <div className="space-y-5">
          {visibleInSection.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={answers[field.id]}
              required={isRequiredNow(field, answers)}
              showError={showErrors}
              onChange={(v) => setAnswer(field.id, v)}
              ensureSaved={persist}
            />
          ))}
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy || step === 0}
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
          >
            Back
          </Button>
          <Button variant="ghost" disabled={busy} onClick={saveAndExit}>
            Save &amp; finish later
          </Button>
        </div>
        {isLast ? (
          <Button disabled={busy} onClick={complete}>
            {busy ? "Finishing…" : "Complete setup"}
          </Button>
        ) : (
          <Button disabled={busy} onClick={goNext}>
            {busy ? "Saving…" : "Save & continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
