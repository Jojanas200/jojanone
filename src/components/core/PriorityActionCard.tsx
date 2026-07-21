import type { Activity } from "@/data/types";
import { MODULES } from "@/config/modules.config";
import { StatusPill, priorityTone } from "./StatusPill";
import { formatRelative } from "@/data/selectors";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, CheckCircle2 } from "lucide-react";

export function PriorityActionCard({
  activity,
  onOpen,
  onAskJova,
  onComplete,
}: {
  activity: Activity;
  onOpen: () => void;
  onAskJova: () => void;
  onComplete: () => void;
}) {
  const mod = MODULES.find((m) => m.key === activity.module)!;
  const Icon = mod.icon;
  const due = activity.due_at ? formatRelative(activity.due_at) : "-";
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
          <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">{activity.title}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{activity.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={priorityTone(activity.priority)}>{activity.priority} priority</StatusPill>
        <span className="text-[12px] text-muted-foreground">{mod.title} · due {due}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onOpen}>
          Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onAskJova}>
          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask Jova
        </Button>
        <Button size="sm" variant="ghost" onClick={onComplete} className="ml-auto text-muted-foreground">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark done
        </Button>
      </div>
    </div>
  );
}