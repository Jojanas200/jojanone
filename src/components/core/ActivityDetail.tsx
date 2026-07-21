import type { Activity } from "@/data/types";
import { MODULES } from "@/config/modules.config";
import { StatusPill, activityStatusTone, priorityTone } from "./StatusPill";
import { formatDateTime } from "@/data/selectors";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageSquare, CheckCircle2 } from "lucide-react";

export function ActivityDetail({
  activity,
  onComplete,
  onAskJova,
  onClose,
}: {
  activity: Activity;
  onComplete?: () => void;
  onAskJova?: () => void;
  onClose?: () => void;
}) {
  const mod = MODULES.find((m) => m.key === activity.module)!;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={activityStatusTone(activity.status)}>{activity.status.replace("_", " ")}</StatusPill>
        {activity.priority !== "none" && (
          <StatusPill tone={priorityTone(activity.priority)}>{activity.priority} priority</StatusPill>
        )}
        <span className="text-[12px] text-muted-foreground">{mod.title}</span>
      </div>
      <p className="text-[14px] leading-relaxed text-foreground">{activity.description}</p>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-[oklch(0.98_0.003_260)] p-4 text-[13px]">
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd className="mt-0.5 font-medium text-foreground capitalize">{activity.activity_type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Module</dt>
          <dd className="mt-0.5 font-medium text-foreground">{mod.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="mt-0.5 font-medium text-foreground">{formatDateTime(activity.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Due</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {activity.due_at ? formatDateTime(activity.due_at) : "-"}
          </dd>
        </div>
        {activity.completed_at && (
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="mt-0.5 font-medium text-foreground">{formatDateTime(activity.completed_at)}</dd>
          </div>
        )}
        {activity.reference_type && (
          <div>
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {activity.reference_type} · {activity.reference_id}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={mod.route} onClick={onClose}>
            Open {mod.title} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
        {onAskJova && (
          <Button size="sm" variant="ghost" onClick={onAskJova}>
            <MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask Jova about this
          </Button>
        )}
        {onComplete && activity.status !== "completed" && (
          <Button size="sm" variant="ghost" onClick={onComplete} className="ml-auto">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark complete
          </Button>
        )}
      </div>
    </div>
  );
}