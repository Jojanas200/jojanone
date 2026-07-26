"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  fieldsByModule,
  isAnswered,
  isVisible,
} from "@/shared/onboarding/logic";
import type {
  FieldDef,
  JsonValue,
  OnboardingAnswers,
} from "@/shared/onboarding/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldControl } from "./FieldControl";

// Onboarding-flow-only field types have no place in an in-module editor.
const EXCLUDED = new Set([
  "password",
  "consent",
  "file",
  "people_list",
  "team_invites",
]);

type ResponsesState = {
  answers: OnboardingAnswers;
  completedAt: string | null;
  complete: boolean;
};

/**
 * Field-level progressive onboarding, in context. Renders the onboarding fields
 * whose destinationModule is `moduleKey`, reading/writing the SAME
 * onboarding_responses blob via the shared field renderer + save API. Shows only
 * while onboarding is incomplete AND this module still has unanswered questions,
 * so it disappears once there's nothing left to furnish here.
 *
 * If a save here leaves the whole initially-required set satisfied, the card
 * surfaces a "Finish setup" button so onboarding can be completed right here.
 */
export function ModuleSetup({
  moduleKey,
  title,
}: {
  moduleKey: string;
  title: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [completed, setCompleted] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Set true only when a save IN THIS card leaves onboarding complete-able, so
  // the "Finish setup" CTA is scoped to where the last field was filled.
  const [finishReady, setFinishReady] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding/responses")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: ResponsesState | null) => {
        if (!s) return;
        setAnswers(s.answers ?? {});
        setCompleted(!!s.completedAt);
      })
      .catch(() => {});
  }, []);

  const moduleFields: FieldDef[] = useMemo(
    () =>
      (fieldsByModule()[moduleKey] ?? []).filter((f) => !EXCLUDED.has(f.type)),
    [moduleKey],
  );

  if (answers === null || completed) return null;

  const visible = moduleFields.filter((f) => isVisible(f, answers));
  const unanswered = visible.filter((f) => !isAnswered(f, answers[f.id]));
  // Keep the card up while there's something to furnish, or to offer the finish.
  if (visible.length === 0 || (unanswered.length === 0 && !finishReady))
    return null;

  const current = answers;

  const setField = (id: string, v: JsonValue | undefined) =>
    setAnswers((a) => {
      const next = { ...(a ?? {}) };
      if (v === undefined || v === "") delete next[id];
      else next[id] = v;
      return next;
    });

  async function save() {
    setBusy(true);
    try {
      const payload: OnboardingAnswers = {};
      for (const f of visible) payload[f.id] = current[f.id] ?? null;
      const res = await fetch("/api/onboarding/responses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Could not save",
        );
      const state = (await res.json()) as ResponsesState;
      setAnswers(state.answers);
      setFinishReady(state.complete);
      toast.success(
        state.complete ? "Saved - that's everything required!" : "Saved",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        missing?: string[];
      };
      if (res.ok) {
        setCompleted(true); // hides the card immediately
        toast.success("You’re all set up!");
        router.refresh();
      } else {
        toast.error(
          `${body.missing?.length ?? "Some"} item${
            body.missing?.length === 1 ? "" : "s"
          } still needed - use Resume setup to review.`,
        );
      }
    } finally {
      setFinishing(false);
    }
  }

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5 p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-foreground">
            {finishReady && unanswered.length === 0
              ? `${title} setup complete`
              : `Finish your ${title} setup`}
          </p>
          <p className="text-xs text-muted-foreground">
            {finishReady && unanswered.length === 0
              ? "That's everything required - you can finish setup now."
              : `${unanswered.length} quick question${
                  unanswered.length === 1 ? "" : "s"
                } to complete - saved to your workspace setup.`}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="space-y-5 border-t border-primary/20 p-5">
          {visible.map((f) => (
            <FieldControl
              key={f.id}
              field={f}
              value={current[f.id]}
              required={false}
              showError={false}
              onChange={(v) => setField(f.id, v)}
              ensureSaved={async () => true}
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button
              variant={finishReady ? "outline" : "default"}
              size="sm"
              disabled={busy || finishing}
              onClick={save}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
            {finishReady && (
              <Button size="sm" disabled={finishing || busy} onClick={finish}>
                {finishing ? "Finishing…" : "Finish setup"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
