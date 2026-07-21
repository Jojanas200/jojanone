"use client";
import { useState } from "react";
import Link from "next/link";
import type { JovaFinding, Severity } from "@/server/services/jova";

const SEV_META: Record<
  Severity,
  { label: string; dot: string; text: string; ring: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "ring-destructive/30",
  },
  high: {
    label: "High",
    dot: "bg-destructive/80",
    text: "text-destructive",
    ring: "ring-destructive/20",
  },
  medium: {
    label: "Medium",
    dot: "bg-amber-500",
    text: "text-amber-600",
    ring: "ring-amber-500/20",
  },
  low: {
    label: "Low",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "ring-border",
  },
};

const ORDER: Severity[] = ["critical", "high", "medium", "low"];

export function JovaBriefing({
  findings,
  counts,
}: {
  findings: JovaFinding[];
  counts: Record<Severity, number>;
}) {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const shown =
    filter === "all" ? findings : findings.filter((f) => f.severity === filter);

  const chips: { key: Severity | "all"; label: string; n: number }[] = [
    { key: "all", label: "All", n: findings.length },
    ...ORDER.filter((s) => counts[s] > 0).map((s) => ({
      key: s,
      label: SEV_META[s].label,
      n: counts[s],
    })),
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              filter === c.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {c.label} ({c.n})
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((f) => {
          const m = SEV_META[f.severity];
          return (
            <li key={f.id}>
              <Link
                href={f.href}
                className={`block rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-inset transition hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${m.ring}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs font-medium uppercase tracking-wide ${m.text}`}
                  >
                    {m.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {f.module}
                  </span>
                </div>
                <p className="mt-1.5 font-medium text-foreground">{f.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {f.explanation}
                </p>
                <p className="mt-2 text-sm text-foreground">
                  <span className="font-medium">Do this: </span>
                  {f.action}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
