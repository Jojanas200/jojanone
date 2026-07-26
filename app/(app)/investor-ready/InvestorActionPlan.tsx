"use client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DdItem = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  owner: string | null;
};

const nice = (s: string) => s.replace(/_/g, " ");
const priorityVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = { high: "destructive", medium: "warning", low: "success" };
const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };

// Prioritised plan: the assessment's recommended actions plus open
// due-diligence items, worst-first. Closing the biggest gaps first.
export function InvestorActionPlan({
  recommendedActions,
  dueDiligence,
}: {
  recommendedActions: string[];
  dueDiligence: DdItem[];
}) {
  const open = dueDiligence
    .filter((i) => i.status !== "ready" && i.status !== "not_applicable")
    .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));

  if (recommendedActions.length === 0 && open.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nothing outstanding. Run the assessment and add due-diligence items to
        build a prioritised action plan.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Prioritised items to close the biggest gaps first.
      </p>

      {recommendedActions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            From your assessment
          </h3>
          <ul className="space-y-2">
            {recommendedActions.map((a, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"
              >
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Open due-diligence items ({open.length})
          </h3>
          <div className="space-y-2">
            {open.map((i) => (
              <Card
                key={i.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {i.title}
                    </p>
                    <Badge variant={priorityVariant[i.priority] ?? "outline"}>
                      {i.priority}
                    </Badge>
                    <span className="text-[11px] capitalize text-muted-foreground">
                      {nice(i.category)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Status: {nice(i.status)}
                    {i.owner ? ` · Owner: ${i.owner}` : ""}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
