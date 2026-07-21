import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { cn } from "@/lib/utils";
import type { Risk, ComplianceObligation } from "@/data/types";
import { obligationStatusLabel } from "@/data/cg-selectors";

export function ApplicabilityBadge({ o }: { o: ComplianceObligation }) {
  if (o.applicability_status === "not_applicable") return <StatusPill tone="neutral">Not applicable</StatusPill>;
  if (o.applicability_status === "unclear") return <StatusPill tone="warning">Unclear</StatusPill>;
  return <StatusPill tone="info">Applicable</StatusPill>;
}

export function ObligationStatusPill({ o }: { o: ComplianceObligation }) {
  const label = obligationStatusLabel(o);
  const tone: Tone =
    label === "Completed" ? "success" :
    label === "Overdue" ? "danger" :
    label === "Action required" ? "warning" :
    label === "Not applicable" ? "neutral" :
    label === "In progress" ? "warning" : "info";
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

export function RiskRatingPill({ rating }: { rating: Risk["residual_rating"] }) {
  const tone: Tone =
    rating === "critical" ? "danger" : rating === "high" ? "danger" : rating === "medium" ? "warning" : "success";
  return <StatusPill tone={tone}>{rating}</StatusPill>;
}

export function ControlEffectivenessBadge({ level }: { level: Risk["control_effectiveness"] }) {
  const tone: Tone = level === "strong" ? "success" : level === "adequate" ? "info" : level === "weak" ? "warning" : "danger";
  return <StatusPill tone={tone}>{level === "none" ? "no controls" : level}</StatusPill>;
}

export function RiskMatrix({
  risks,
  view,
  onSelect,
}: {
  risks: Risk[];
  view: "inherent" | "residual";
  onSelect: (r: Risk) => void;
}) {
  const cellColor = (l: number, i: number) => {
    const s = l * i;
    if (s >= 17) return "bg-[oklch(0.92_0.1_25)]";
    if (s >= 10) return "bg-[oklch(0.95_0.08_30)]";
    if (s >= 5) return "bg-[oklch(0.97_0.08_85)]";
    return "bg-[oklch(0.96_0.05_148)]";
  };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Impact →
        </div>
        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
          <div />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground">{i}</div>
          ))}
          {[5, 4, 3, 2, 1].map((l) => (
            <>
              <div key={`l-${l}`} className="flex items-center pr-2 text-right text-[11px] font-semibold text-muted-foreground">{l}</div>
              {[1, 2, 3, 4, 5].map((i) => {
                const cellRisks = risks.filter((r) => {
                  const rl = view === "inherent" ? r.likelihood : r.residual_likelihood;
                  const ri = view === "inherent" ? r.impact : r.residual_impact;
                  return rl === l && ri === i;
                });
                return (
                  <div key={`${l}-${i}`} className={cn("min-h-[62px] rounded p-1", cellColor(l, i))}>
                    <div className="flex flex-wrap gap-1">
                      {cellRisks.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onSelect(r)}
                          className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm hover:bg-white"
                          title={r.risk_title}
                        >
                          {r.risk_title.length > 20 ? r.risk_title.slice(0, 18) + "…" : r.risk_title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ))}
        </div>
        <div className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          ← Likelihood
        </div>
      </div>
    </div>
  );
}