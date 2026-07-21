import type { Activity, ModuleKey } from "@/data/types";
import { formatRelative } from "@/data/selectors";
import { StatusPill, activityStatusTone, priorityTone } from "./StatusPill";
import { MODULES } from "@/config/modules.config";
import { cn } from "@/lib/utils";

function moduleMeta(key: ModuleKey) {
  return MODULES.find((m) => m.key === key)!;
}

export function ActivityCard({
  activity,
  onOpen,
  compact = false,
}: {
  activity: Activity;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const mod = moduleMeta(activity.module);
  const Icon = mod.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm",
        compact && "p-3",
      )}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[oklch(0.97_0.005_260)]">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-[14px] font-medium text-foreground">{activity.title}</p>
          <StatusPill tone={activityStatusTone(activity.status)}>{activity.status.replace("_", " ")}</StatusPill>
          {activity.priority !== "none" && (
            <StatusPill tone={priorityTone(activity.priority)}>{activity.priority}</StatusPill>
          )}
        </div>
        {!compact && (
          <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{activity.description}</p>
        )}
        <p className="mt-1 text-[12px] text-muted-foreground">
          {mod.title} · {formatRelative(activity.created_at)}
          {activity.due_at && ` · due ${formatRelative(activity.due_at)}`}
        </p>
      </div>
    </button>
  );
}