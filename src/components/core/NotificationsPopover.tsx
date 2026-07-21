import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useCoreData, markAllNotificationsRead, markNotificationRead } from "@/data/store";
import { formatRelative } from "@/data/selectors";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function NotificationsPopover() {
  const notifications = useCoreData((s) => s.notifications);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  const handleOpen = (n: (typeof notifications)[number]) => {
    markNotificationRead(n.id);
    setOpen(false);
    if (n.reference_type === "activity" && n.reference_id) navigate({ to: "/timeline", search: { a: n.reference_id } });
    else if (n.reference_type === "report" && n.reference_id) navigate({ to: "/reports", search: { r: n.reference_id } });
    else if (n.reference_type === "conversation" && n.reference_id) navigate({ to: "/jova", search: { c: n.reference_id } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-md text-foreground hover:bg-[oklch(0.97_0.005_260)]"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-[13px] font-semibold">Notifications</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAllNotificationsRead()}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">You&apos;re all caught up.</p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleOpen(n)}
              className={cn(
                "flex w-full flex-col items-start gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-accent",
                !n.read && "bg-[oklch(0.98_0.02_264)]",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-foreground">{n.title}</p>
                {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </div>
              <p className="text-[12px] text-muted-foreground">{n.description}</p>
              <p className="text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}