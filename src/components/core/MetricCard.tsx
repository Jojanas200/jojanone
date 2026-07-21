import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "warning" | "success";
  onClick?: () => void;
}) {
  const toneRing = {
    default: "",
    danger: "ring-1 ring-[oklch(0.9_0.05_25)]",
    warning: "ring-1 ring-[oklch(0.9_0.06_75)]",
    success: "ring-1 ring-[oklch(0.9_0.05_148)]",
  }[tone];
  return (
    <Card
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 border border-border bg-card p-5 shadow-[var(--shadow-xs)] transition-shadow",
        onClick && "cursor-pointer hover:shadow-[var(--shadow-md)]",
        toneRing,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
      </div>
      <div className="text-[28px] font-semibold leading-tight text-foreground">{value}</div>
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}