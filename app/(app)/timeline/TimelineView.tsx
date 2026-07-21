"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { TimelineEvent } from "@/server/services/timeline";

const MODULE_LABEL: Record<string, string> = {
  compliance: "Compliance",
  contracts: "Contracts",
  risk: "Risk",
  hr: "HR",
  gdpr: "GDPR",
  governance: "Governance",
  "tender-ready": "Tender",
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const todayStr = (now: string) => now;

export function TimelineView({
  events,
  today,
}: {
  events: TimelineEvent[];
  today: string;
}) {
  const [filter, setFilter] = useState<string>("all");

  const modules = useMemo(() => {
    const seen = new Set(events.map((e) => e.module));
    return [
      "all",
      ...Object.keys(MODULE_LABEL).filter((m) => seen.has(m as never)),
    ];
  }, [events]);

  const shown =
    filter === "all" ? events : events.filter((e) => e.module === filter);

  const upcoming = shown.filter((e) => e.date >= today);
  const past = shown.filter((e) => e.date < today);

  const Row = ({ e }: { e: TimelineEvent }) => (
    <Link
      href={e.href}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition hover:bg-muted/50"
    >
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {fmt(e.date)}
      </span>
      <Badge variant="outline" className="shrink-0">
        {MODULE_LABEL[e.module] ?? e.module}
      </Badge>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {e.kind}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{e.title}</span>
    </Link>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {modules.map((m) => (
          <button
            key={m}
            onClick={() => setFilter(m)}
            aria-pressed={filter === m}
            className={`rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              filter === m
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {m === "all" ? "All" : (MODULE_LABEL[m] ?? m)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No dated events yet. As you add obligations, contracts and decisions,
          they&apos;ll appear here.
        </p>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Upcoming ({upcoming.length})
              </h2>
              {/* Upcoming reads soonest-first. */}
              <div className="space-y-1.5">
                {[...upcoming].reverse().map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Past ({past.length})
              </h2>
              <div className="space-y-1.5">
                {past.map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">
        As of {todayStr(fmt(today))}.
      </p>
    </>
  );
}
