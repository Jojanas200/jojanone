import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function DateStatusBadge({ iso, label = "due" }: { iso: string | null | undefined; label?: string }) {
  if (!iso) return <StatusPill tone="neutral">No date</StatusPill>;
  const d = new Date(iso).getTime();
  const days = Math.round((d - Date.now()) / 86400000);
  let tone: Tone = "info";
  let text = "";
  if (days < 0) {
    tone = "danger";
    text = `${Math.abs(days)}d overdue`;
  } else if (days <= 14) {
    tone = "warning";
    text = `${label} in ${days}d`;
  } else if (days <= 60) {
    tone = "info";
    text = `${label} in ${days}d`;
  } else {
    tone = "neutral";
    text = new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return <StatusPill tone={tone}>{text}</StatusPill>;
}

export function InfoRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{value ?? "-"}</span>
    </div>
  );
}

export function Field({
  label,
  children,
  required,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[13px]">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <span className="text-[12px] text-muted-foreground">{hint}</span>}
      {error && <span className="text-[12px] text-destructive">{error}</span>}
    </div>
  );
}

export function ActionChecklist({
  items,
  onToggle,
}: {
  items: Array<{ id: string; label: string; done: boolean; hint?: string }>;
  onToggle?: (id: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            disabled={!onToggle}
            onClick={() => onToggle?.(it.id)}
            className={cn(
              "flex w-full items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-[13px]",
              onToggle && "hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-4 w-4 place-items-center rounded border",
                it.done ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {it.done && "✓"}
            </span>
            <span className="flex-1">
              <span className={cn("block font-medium", it.done && "text-muted-foreground line-through")}>{it.label}</span>
              {it.hint && <span className="mt-0.5 block text-[12px] text-muted-foreground">{it.hint}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ModuleSummaryCard({
  title,
  value,
  hint,
  tone = "neutral",
  action,
  onClick,
}: {
  title: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  action?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 border border-border bg-card p-5 shadow-none",
        onClick && "cursor-pointer hover:shadow-sm transition-shadow",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
        <StatusPill tone={tone}>{typeof value === "number" ? value : value}</StatusPill>
      </div>
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      {action}
    </Card>
  );
}

export const disclaimerScenario =
  "The Scenario Simulator provides general business information based on the details entered. It does not provide legal, tax or financial advice. Where professional judgement is required, Jojan One will recommend expert support.";

export const disclaimerHr =
  "This matter may require professional HR or legal judgement. Jojan One can help organise the information and next steps but should not be relied upon as a substitute for qualified advice.";

export const disclaimerJova =
  "Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.";

export { Card, Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue };