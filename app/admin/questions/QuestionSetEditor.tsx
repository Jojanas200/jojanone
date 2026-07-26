"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "lines" | "number" | "boolean";
  options?: string[];
  required?: boolean;
  hint?: string;
  oneBased?: boolean;
};

type SetData = {
  key: string;
  label: string;
  group: string;
  description: string;
  fields: FieldDef[];
  items: Record<string, unknown>[];
  overridden: boolean;
};

export function QuestionSetEditor({
  sets,
  canWrite,
}: {
  sets: SetData[];
  canWrite: boolean;
}) {
  const [data, setData] = useState<Record<string, SetData>>(() =>
    Object.fromEntries(sets.map((s) => [s.key, s])),
  );
  const [activeKey, setActiveKey] = useState(sets[0]?.key ?? "");
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const active = data[activeKey];

  const groups = [...new Set(sets.map((s) => s.group))];

  function patchItems(items: Record<string, unknown>[]) {
    setData((p) => ({ ...p, [activeKey]: { ...p[activeKey], items } }));
    setDirty((p) => ({ ...p, [activeKey]: true }));
  }

  async function reload() {
    const res = await fetch("/api/admin/question-sets");
    if (!res.ok) return;
    const body = (await res.json()) as { sets: SetData[] };
    setData(Object.fromEntries(body.sets.map((s) => [s.key, s])));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/question-sets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: activeKey, questions: active.items }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to save");
      toast.success("Questionnaire saved - now live for all tenants");
      setDirty((p) => ({ ...p, [activeKey]: false }));
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/question-sets?key=${encodeURIComponent(activeKey)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to reset");
      toast.success("Reverted to the built-in default");
      setDirty((p) => ({ ...p, [activeKey]: false }));
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function blankItem(): Record<string, unknown> {
    const item: Record<string, unknown> = {};
    for (const f of active.fields) {
      if (f.type === "lines") item[f.key] = [];
      else if (f.type === "number") item[f.key] = 0;
      else if (f.type === "boolean") item[f.key] = false;
      else if (f.type === "select") item[f.key] = f.options?.[0] ?? "";
      else item[f.key] = "";
    }
    return item;
  }

  if (!active) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeKey} onValueChange={setActiveKey}>
          <SelectTrigger className="w-full sm:w-96">
            <SelectValue placeholder="Choose a questionnaire" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <div key={g}>
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {g}
                </p>
                {sets
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                      {dirty[s.key] ? " *" : ""}
                    </SelectItem>
                  ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={active.overridden ? "warning" : "outline"}>
          {active.overridden ? "Customised" : "Default"}
        </Badge>
        {dirty[activeKey] && <Badge variant="outline">Unsaved changes</Badge>}
      </div>

      <p className="text-sm text-muted-foreground">{active.description}</p>

      <div className="space-y-3">
        {active.items.map((item, i) => (
          <Card key={i} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Question {i + 1}
              </p>
              {canWrite && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...active.items];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      patchItems(next);
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={i === active.items.length - 1}
                    onClick={() => {
                      const next = [...active.items];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      patchItems(next);
                    }}
                  >
                    Down
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      patchItems(active.items.filter((_, j) => j !== i))
                    }
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {active.fields.map((f) => (
                <FieldInput
                  key={f.key}
                  def={f}
                  value={item[f.key]}
                  disabled={!canWrite}
                  onChange={(v) => {
                    const next = [...active.items];
                    next[i] = { ...next[i], [f.key]: v };
                    patchItems(next);
                  }}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => patchItems([...active.items, blankItem()])}
          >
            Add question
          </Button>
          <Button onClick={save} disabled={busy || !dirty[activeKey]}>
            {busy ? "Saving..." : "Save questionnaire"}
          </Button>
          {active.overridden && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Reset to default
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  def,
  value,
  disabled,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  const wide = def.type === "textarea" || def.type === "lines";
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {def.label}
        {def.required ? " *" : ""}
      </span>
      {def.type === "textarea" && (
        <Textarea
          rows={2}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {def.type === "text" && (
        <Input
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {def.type === "lines" && (
        <Textarea
          rows={4}
          value={Array.isArray(value) ? (value as string[]).join("\n") : ""}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            )
          }
        />
      )}
      {def.type === "number" && (
        <Input
          type="number"
          value={String(Number(value ?? 0) + (def.oneBased ? 1 : 0))}
          disabled={disabled}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(n - (def.oneBased ? 1 : 0));
          }}
        />
      )}
      {def.type === "select" && (
        <Select
          value={String(value ?? "")}
          disabled={disabled}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {def.type === "boolean" && (
        <Select
          value={value ? "yes" : "no"}
          disabled={disabled}
          onValueChange={(v) => onChange(v === "yes")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
          </SelectContent>
        </Select>
      )}
      {def.hint && (
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {def.hint}
        </span>
      )}
    </label>
  );
}
