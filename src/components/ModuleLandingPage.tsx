import type { ModuleConfig } from "@/config/modules.config";
import { StatusBadge } from "./StatusBadge";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export function ModuleLandingPage({ module }: { module: ModuleConfig }) {
  const Icon = module.icon;
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-10 md:py-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[oklch(0.955_0.05_264)]">
            <Icon className="h-8 w-8 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-foreground">
            {module.title}
          </h1>
        </div>
        <StatusBadge status={module.status} />
      </div>

      {/* Tagline + description */}
      <div className="mt-6 max-w-[640px] space-y-2">
        <p className="text-[17px] font-medium text-foreground">
          {module.tagline}
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--body-text)]">
          {module.description}
        </p>
      </div>

      {/* Divider */}
      <div className="my-10 h-px w-full bg-border" />

      {/* What's coming */}
      <Card className="border border-border bg-card p-6 shadow-none transition-shadow hover:shadow-sm md:p-8">
        <h2 className="text-[18px] font-semibold text-foreground">
          What this module will include
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {module.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-3 text-[15px] text-[var(--body-text)]"
            >
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[oklch(0.955_0.05_264)]">
                <ChevronRight className="h-3 w-3 text-primary" strokeWidth={2.5} />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Footer note */}
      <p className="mt-8 text-[13px] text-muted-foreground">
        This module is part of the Jojan One roadmap. {module.status} - you'll be
        notified when it's ready.
      </p>
    </div>
  );
}