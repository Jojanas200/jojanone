"use client";
import { useMemo, useState } from "react";

type Area = { key: string; label: string; score: number; weight: number };

// Each lever nudges one area's score by `delta` per unit. Deltas mirror the
// Business Confidence scoring model so the projection stays honest.
type Lever = {
  id: string;
  label: string;
  area: string;
  delta: number;
  hint: string;
};

const RISKS: Lever[] = [
  {
    id: "hires_no_rtw",
    label: "New hires without right-to-work evidence",
    area: "people",
    delta: -10,
    hint: "Each unchecked hire is an illegal-working exposure.",
  },
  {
    id: "high_risk_contracts",
    label: "New high-risk contracts signed",
    area: "contracts",
    delta: -8,
    hint: "Unmitigated contractual risk.",
  },
  {
    id: "critical_risks",
    label: "New critical risks opened",
    area: "risk",
    delta: -20,
    hint: "Top-severity risks weigh heaviest.",
  },
  {
    id: "overdue_obligations",
    label: "Obligations slipping overdue",
    area: "compliance",
    delta: -12,
    hint: "Missed statutory deadlines.",
  },
  {
    id: "special_data",
    label: "Unreviewed special-category data uses",
    area: "gdpr",
    delta: -8,
    hint: "Higher-risk processing without review.",
  },
];

const IMPROVEMENTS: Lever[] = [
  {
    id: "rtw_done",
    label: "Right-to-work checks completed",
    area: "people",
    delta: 10,
    hint: "Close illegal-working exposure.",
  },
  {
    id: "obligations_resolved",
    label: "Overdue obligations resolved",
    area: "compliance",
    delta: 12,
    hint: "Bring filings back on track.",
  },
  {
    id: "risks_mitigated",
    label: "Critical risks mitigated / closed",
    area: "risk",
    delta: 20,
    hint: "Reduce top-severity exposure.",
  },
  {
    id: "governance_approved",
    label: "Governance decisions approved",
    area: "governance",
    delta: 4,
    hint: "Clear the approval backlog.",
  },
];

const ALL = [...RISKS, ...IMPROVEMENTS];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const tone = (n: number) =>
  n >= 80
    ? "text-emerald-600"
    : n >= 60
      ? "text-amber-600"
      : "text-destructive";
const bar = (n: number) =>
  n >= 80 ? "bg-emerald-500" : n >= 60 ? "bg-amber-500" : "bg-destructive";

export function SimulatorView({
  areas,
  baseScore,
}: {
  areas: Area[];
  baseScore: number;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const projected = useMemo(() => {
    const byArea = new Map(areas.map((a) => [a.key, a.score]));
    for (const lever of ALL) {
      const n = counts[lever.id] ?? 0;
      if (!n) continue;
      const cur = byArea.get(lever.area);
      if (cur === undefined) continue;
      byArea.set(lever.area, cur + lever.delta * n);
    }
    const projAreas = areas.map((a) => ({
      ...a,
      projected: clamp(byArea.get(a.key) ?? a.score),
    }));
    const totalWeight = projAreas.reduce((s, a) => s + a.weight, 0);
    const overall = clamp(
      projAreas.reduce((s, a) => s + a.projected * a.weight, 0) / totalWeight,
    );
    return { projAreas, overall };
  }, [areas, counts]);

  const set = (id: string, v: number) =>
    setCounts((p) => ({ ...p, [id]: Math.max(0, v) }));
  const reset = () => setCounts({});

  const delta = projected.overall - baseScore;
  const anyActive = Object.values(counts).some((v) => v > 0);

  const Stepper = ({ lever }: { lever: Lever }) => {
    const n = counts[lever.id] ?? 0;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{lever.label}</p>
          <p className="text-xs text-muted-foreground">{lever.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => set(lever.id, n - 1)}
            className="h-7 w-7 rounded-md border border-border text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
            disabled={n === 0}
            aria-label={`Decrease ${lever.label}`}
          >
            −
          </button>
          <span className="w-6 text-center text-sm tabular-nums">{n}</span>
          <button
            type="button"
            onClick={() => set(lever.id, n + 1)}
            className="h-7 w-7 rounded-md border border-border text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Increase ${lever.label}`}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Risks &amp; changes
          </h2>
          <div className="space-y-2">
            {RISKS.map((l) => (
              <Stepper key={l.id} lever={l} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Improvements
          </h2>
          <div className="space-y-2">
            {IMPROVEMENTS.map((l) => (
              <Stepper key={l.id} lever={l} />
            ))}
          </div>
        </section>
      </div>

      {/* Projection panel */}
      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Projected confidence
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className={`text-4xl font-bold ${tone(projected.overall)}`}>
              {projected.overall}
            </span>
            <span className="mb-1 text-sm text-muted-foreground">
              from {baseScore}
            </span>
          </div>
          {anyActive && (
            <p
              className={`mt-1 text-sm font-medium ${delta < 0 ? "text-destructive" : delta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}
            >
              {delta > 0 ? "+" : ""}
              {delta} points
            </p>
          )}

          <div className="mt-4 space-y-2.5">
            {projected.projAreas.map((a) => (
              <div key={a.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="tabular-nums text-foreground">
                    {a.projected}
                    {a.projected !== a.score && (
                      <span className="text-muted-foreground">
                        {" "}
                        (was {a.score})
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${bar(a.projected)}`}
                    style={{ width: `${a.projected}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={reset}
            disabled={!anyActive}
            className="mt-4 w-full rounded-md border border-border py-2 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
          >
            Reset scenario
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          A model, not advice. Projections use the same weighting as your live
          Business Confidence Score.
        </p>
      </div>
    </div>
  );
}
