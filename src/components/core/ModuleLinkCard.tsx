import { Link } from "@tanstack/react-router";
import { MODULES } from "@/config/modules.config";
import type { ModuleKey } from "@/data/types";
import { ArrowUpRight } from "lucide-react";

export function ModuleLinkCard({ moduleKey, subtitle }: { moduleKey: ModuleKey; subtitle?: string }) {
  const m = MODULES.find((x) => x.key === moduleKey)!;
  const Icon = m.icon;
  return (
    <Link
      to={m.route}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
    >
      <div className="grid h-10 w-10 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground">{m.title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{subtitle ?? m.tagline}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}