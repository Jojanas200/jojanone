"use client";
import { isAnswered, validateValue } from "@/shared/onboarding/logic";
import type { FieldDef, JsonValue } from "@/shared/onboarding/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

// -----------------------------------------------------------------------------
// A single schema-driven field. Switches on field.type so every field type is
// rendered by this one component — shared by the onboarding wizard and the
// per-module setup cards.
// -----------------------------------------------------------------------------
export function FieldControl({
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
