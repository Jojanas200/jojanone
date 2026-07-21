import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const styles: Record<Tone, string> = {
  success: "bg-[oklch(0.95_0.06_148)] text-[oklch(0.42_0.15_148)]",
  warning: "bg-[oklch(0.96_0.08_85)] text-[oklch(0.45_0.15_75)]",
  danger: "bg-[oklch(0.95_0.05_25)] text-[oklch(0.5_0.2_25)]",
  info: "bg-[oklch(0.955_0.05_264)] text-[oklch(0.45_0.2_264)]",
  neutral: "bg-[oklch(0.955_0.005_260)] text-[oklch(0.4_0.015_260)]",
};

const dots: Record<Tone, string> = {
  success: "bg-[oklch(0.62_0.18_148)]",
  warning: "bg-[oklch(0.7_0.15_75)]",
  danger: "bg-[oklch(0.6_0.22_25)]",
  info: "bg-[oklch(0.55_0.22_264)]",
  neutral: "bg-[oklch(0.68_0.015_260)]",
};

export function StatusPill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        styles[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />
      {children}
    </span>
  );
}

export function activityStatusTone(status: string): Tone {
  switch (status) {
    case "completed":
      return "success";
    case "overdue":
      return "danger";
    case "open":
    case "in_progress":
      return "warning";
    case "upcoming":
      return "info";
    default:
      return "neutral";
  }
}

export function priorityTone(p: string): Tone {
  if (p === "high") return "danger";
  if (p === "medium") return "warning";
  if (p === "low") return "info";
  return "neutral";
}

export function areaStatusTone(s: string): Tone {
  if (s === "good") return "success";
  if (s === "attention") return "warning";
  return "danger";
}