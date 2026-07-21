import { cn } from "@/lib/utils";
import { formatRelative } from "@/data/selectors";
import type { JovaConversation } from "@/data/types";
import { Trash2 } from "lucide-react";

export function ConversationListItem({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: JovaConversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-md px-2 py-2 transition-colors",
        active ? "bg-accent" : "hover:bg-[oklch(0.97_0.005_260)]",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-[13px] font-medium", active ? "text-primary" : "text-foreground")}>
          {conversation.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelative(conversation.updated_at)}</p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete conversation"
        className="grid h-7 w-7 shrink-0 place-items-center rounded opacity-0 hover:bg-background group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}