import type { ModuleStatus } from "@/config/modules.config";
import { cn } from "@/lib/utils";

const styles: Record<ModuleStatus, string> = {
  Live: "bg-[oklch(0.95_0.06_148)] text-[oklch(0.42_0.15_148)]",
  "In Development": "bg-[oklch(0.955_0.05_264)] text-[oklch(0.45_0.2_264)]",
  "Coming Soon": "bg-[oklch(0.955_0.005_260)] text-[oklch(0.5_0.015_260)]",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ModuleStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "Live" && "bg-[oklch(0.62_0.18_148)]",
          status === "In Development" && "bg-[oklch(0.55_0.22_264)]",
          status === "Coming Soon" && "bg-[oklch(0.68_0.015_260)]",
        )}
      />
      {status}
    </span>
  );
}