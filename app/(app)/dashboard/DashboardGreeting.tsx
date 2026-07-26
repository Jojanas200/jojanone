"use client";
import { useEffect, useState } from "react";

// Time-of-day salutation. Computed on the client so it reflects the viewer's
// local time (server time on Vercel is UTC). Renders a neutral greeting until
// mounted to avoid a hydration mismatch.
export function DashboardGreeting({ name }: { name: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const hour = now?.getHours();
  const part =
    hour === undefined
      ? "Hello"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  const dateStr = now
    ? now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Jova is watching
        {dateStr ? (
          <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
            · {dateStr}
          </span>
        ) : null}
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {part}, {name}.
      </h1>
    </div>
  );
}
