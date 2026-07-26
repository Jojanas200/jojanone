import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, nice } from "../_shared/format";
import type { listGovernanceRecords } from "@/server/services/governance";
import type { listPolicies } from "@/server/services/policies";

type Record_ = Awaited<ReturnType<typeof listGovernanceRecords>>[number];
type Policy_ = Awaited<ReturnType<typeof listPolicies>>[number];

type CalItem = {
  id: string;
  date: string;
  label: string;
  kind: string;
  overdue: boolean;
};

// Combines governance meeting/decision dates with policy review dates into one
// chronological view. Server-rendered: "today" is the request time.
export function GovernanceCalendar({
  records,
  policies,
}: {
  records: Record_[];
  policies: Policy_[];
}) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;

  const items: CalItem[] = [
    ...records
      .filter((g) => g.meetingDate || g.decisionDate)
      .map((g) => ({
        id: g.id,
        date: (g.meetingDate ?? g.decisionDate) as string,
        label: g.title,
        kind: nice(g.recordType),
        overdue: false,
      })),
    ...policies
      .filter((p) => p.status !== "archived" && p.reviewDate)
      .map((p) => ({
        id: `pol-${p.id}`,
        date: p.reviewDate as string,
        label: `Review: ${p.policyName}`,
        kind: "policy review",
        overdue: (p.reviewDate as string) < todayStr,
      })),
  ];

  const upcoming = items
    .filter((it) => it.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = items
    .filter((it) => it.date < todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No dated items yet. Meeting and decision dates, plus policy review
        dates, show up here as a running calendar.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <CalendarSection title="Upcoming" items={upcoming} />
      )}
      {past.length > 0 && <CalendarSection title="Earlier" items={past} />}
    </div>
  );
}

function CalendarSection({
  title,
  items,
}: {
  title: string;
  items: CalItem[];
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{it.label}</p>
              <Badge variant="outline" className="mt-1 capitalize">
                {it.kind}
              </Badge>
            </div>
            <span className="shrink-0 text-muted-foreground">
              {fmtDate(it.date)}
              {it.overdue && (
                <span className="ml-1 font-medium text-destructive">
                  (overdue)
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
