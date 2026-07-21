"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Item = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  href: string;
  read: boolean;
  createdAt: string;
};

const rel = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  return `${Math.floor(diff / day)}d ago`;
};

const dotColor: Record<string, string> = {
  priority: "bg-destructive",
  risk: "bg-destructive/80",
  insight: "bg-amber-500",
  report: "bg-muted-foreground",
};

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* silent - the bell is non-critical chrome */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, read: true } : i)),
    );
    setUnread((u) => Math.max(0, u - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  async function markAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold text-foreground">
            Notifications
          </span>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((i) => (
              <li key={i.id}>
                <Link
                  href={i.href}
                  onClick={() => {
                    if (!i.read) markRead(i.id);
                    setOpen(false);
                  }}
                  className={`flex gap-2.5 px-4 py-3 text-sm transition hover:bg-muted/50 ${
                    i.read ? "" : "bg-muted/30"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      i.read
                        ? "bg-transparent"
                        : (dotColor[i.kind] ?? "bg-foreground")
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate ${i.read ? "text-muted-foreground" : "font-medium text-foreground"}`}
                    >
                      {i.title}
                    </span>
                    {i.description && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {i.description}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {rel(i.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
