"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SECTIONS,
  isVisible,
  isRequiredNow,
  isAnswered,
  missingInitialFields,
  validateValue,
} from "@/shared/onboarding/logic";
import type {
  FieldDef,
  JsonValue,
  OnboardingAnswers,
} from "@/shared/onboarding/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentUploader } from "./DocumentUploader";

const sensitivityBadge: Record<string, string | null> = {
  secret: "Never stored",
  special_category: "Special category",
  confidential: "Confidential",
  standard: null,
  low: null,
};

export function OnboardingWizard({
  initialAnswers,
}: {
  initialAnswers: OnboardingAnswers;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [step, setStep] = useState(0);
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

// -----------------------------------------------------------------------------
// A single schema-driven field. Switches on field.type so the whole 150-field
// form is rendered by this one component.
// -----------------------------------------------------------------------------
function FieldControl({
  field,
  value,
  required,
  showError,
  onChange,
  ensureSaved,
}: {
  field: FieldDef;
  value: JsonValue | undefined;
  required: boolean;
  showError: boolean;
  onChange: (v: JsonValue | undefined) => void;
  ensureSaved: () => Promise<boolean>;
}) {
  const badge = sensitivityBadge[field.sensitivity];
  const validationError = validateValue(field, value);
  const missingRequired = required && !isAnswered(field, value);
  const showAsError = showError && (missingRequired || !!validationError);

  const control = renderControl(field, value, onChange, ensureSaved);

  // Progressive placeholders (documents / people / invitations captured later).
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Label htmlFor={field.id} className="text-sm">
          {field.label}
        </Label>
        {required ? (
          <span className="text-xs text-muted-foreground">Required</span>
        ) : (
          <span className="text-xs text-muted-foreground/60">Optional</span>
        )}
        {badge ? (
          <Badge variant="outline" className="text-[10px]">
            {badge}
          </Badge>
        ) : null}
      </div>
      {field.help ? (
        <p className="mb-1.5 text-xs text-muted-foreground">{field.help}</p>
      ) : null}
      {control}
      {value === "unsure" ? (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          We’ll add this to your review list — it won’t block setup.
        </p>
      ) : null}
      {showAsError ? (
        <p className="mt-1 text-xs text-destructive">
          {validationError ?? "This is required."}
        </p>
      ) : null}
    </div>
  );
}

function renderControl(
  field: FieldDef,
  value: JsonValue | undefined,
  onChange: (v: JsonValue | undefined) => void,
  ensureSaved: () => Promise<boolean>,
) {
  const str = typeof value === "string" ? value : "";

  switch (field.type) {
    case "password":
      return (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Set when you signed up and managed securely. Never stored here.
        </p>
      );

    case "file":
      return (
        <DocumentUploader
          variant={field.id === "company.logo" ? "logo" : "documents"}
          ensureSaved={ensureSaved}
        />
      );

    case "people_list":
    case "team_invites":
      return (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          You can add these later in the relevant module — nothing to do now.
        </p>
      );

    case "textarea":
    case "address":
      return (
        <Textarea
          id={field.id}
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <Input
          id={field.id}
          type="number"
          value={typeof value === "number" ? value : ""}
          min={field.validation?.min}
          max={field.validation?.max}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      );

    case "date":
      return (
        <Input
          id={field.id}
          type="date"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "color":
      return (
        <input
          id={field.id}
          type="color"
          value={str || "#4f46e5"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded-md border border-border bg-background"
        />
      );

    case "select":
      return (
        <Select value={str} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={field.id}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1 rounded-lg border border-border p-1">
          {field.options?.map((o) => {
            const checked = arr.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() =>
                    onChange(
                      checked
                        ? arr.filter((x) => x !== o.value)
                        : [...arr, o.value],
                    )
                  }
                />
                <span className="text-sm text-foreground">{o.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "boolean":
      return (
        <Choice
          options={[
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ]}
          value={value}
          onChange={onChange}
        />
      );

    case "yesno_unsure":
      return (
        <Choice
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unsure", label: "Unsure" },
          ]}
          value={value}
          onChange={onChange}
        />
      );

    case "consent":
      return (
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            id={field.id}
            checked={value === true}
            onCheckedChange={(c) => onChange(c === true)}
            className="mt-0.5"
          />
          <span className="text-sm text-muted-foreground">I agree</span>
        </label>
      );

    default:
      // text, email, tel, url
      return (
        <Input
          id={field.id}
          type={
            field.type === "email"
              ? "email"
              : field.type === "tel"
                ? "tel"
                : field.type === "url"
                  ? "url"
                  : "text"
          }
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function Choice({
  options,
  value,
  onChange,
}: {
  options: { value: JsonValue; label: string }[];
  value: JsonValue | undefined;
  onChange: (v: JsonValue) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md border px-4 py-1.5 text-sm transition-colors ${
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
