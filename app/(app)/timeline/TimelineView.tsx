"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  History,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ActivityFeedItem,
  TimelineEvent,
} from "@/server/services/timeline";

// Module display metadata. `route` links each activity back to its module.
const MODULE_META: Record<string, { label: string; route: string }> = {
  compliance: { label: "Compliance", route: "/compliance" },
  contracts: { label: "Contracts", route: "/contracts" },
  risk: { label: "Risk", route: "/risk" },
  hr: { label: "HR", route: "/hr" },
  gdpr: { label: "GDPR", route: "/gdpr" },
  governance: { label: "Governance", route: "/governance" },
  policies: { label: "Policies", route: "/policies" },
  "tender-ready": { label: "Tender", route: "/tender-ready" },
  "investor-ready": { label: "Investor", route: "/investor-ready" },
  academy: { label: "Academy", route: "/academy" },
  evidence: { label: "Evidence", route: "/evidence" },
  jova: { label: "Jova", route: "/jova" },
};
const moduleLabel = (m: string) => MODULE_META[m]?.label ?? m;
const moduleRoute = (m: string) => MODULE_META[m]?.route ?? "/dashboard";

const ACTIVITY_TYPES = [
  "obligation",
  "filing",
  "review",
  "policy",
  "contract",
  "risk",
  "decision",
  "report",
  "system",
  "training",
  "meeting",
];
const STATUSES = [
  "open",
  "in_progress",
  "overdue",
  "upcoming",
  "completed",
  "info",
];
const PRIORITIES = ["high", "medium", "low", "none"];

const statusVariant: Record<
  string,
  "outline" | "secondary" | "default" | "destructive" | "success" | "warning"
> = {
  completed: "success",
  overdue: "destructive",
  open: "warning",
  in_progress: "warning",
  upcoming: "outline",
  info: "outline",
};
const priorityVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  high: "destructive",
  medium: "warning",
  low: "success",
  none: "outline",
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

type ViewKey = "all" | "today" | "week" | "month" | "upcoming";

const nice = (s: string) => s.replace(/_/g, " ");

export function TimelineView({
  feed,
  upcoming,
  today,
  canWrite = false,
}: {
  feed: ActivityFeedItem[];
  upcoming: TimelineEvent[];
  today: string;
  canWrite?: boolean;
}) {
  const [view, setView] = useState<ViewKey>("all");
  const [search, setSearch] = useState("");
  const [moduleF, setModuleF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [detail, setDetail] = useState<ActivityFeedItem | null>(null);

  // Deep link: /timeline?a=<id> opens that activity's detail drawer.
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("a");
    if (!id) return;
    const hit = feed.find((x) => x.id === id);
    if (hit) setDetail(hit);
    // Only on first load - later opens are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modules that actually appear in the feed (keeps the filter list honest).
  const moduleOptions = useMemo(() => {
    const seen = new Set(feed.map((f) => f.module));
    return Array.from(seen);
  }, [feed]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const q = search.trim().toLowerCase();
    return feed.filter((x) => {
      const t = new Date(x.createdAt).getTime();
      if (view === "today" && t < dayStart.getTime()) return false;
      if (view === "week" && t < now - 7 * 86400000) return false;
      if (view === "month" && t < now - 30 * 86400000) return false;
      if (moduleF !== "all" && x.module !== moduleF) return false;
      if (typeF !== "all" && x.activityType !== typeF) return false;
      if (priorityF !== "all" && x.priority !== priorityF) return false;
      if (statusF !== "all" && x.status !== statusF) return false;
      if (
        q &&
        !x.title.toLowerCase().includes(q) &&
        !(x.description ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [feed, view, search, moduleF, typeF, priorityF, statusF]);

  // Group the filtered feed by calendar day (feed is already newest-first).
  const groups = useMemo(() => {
    const map = new Map<string, ActivityFeedItem[]>();
    for (const x of filtered) {
      const key = fmtDay(x.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(x);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const clearFilters = () => {
    setSearch("");
    setModuleF("all");
    setTypeF("all");
    setPriorityF("all");
    setStatusF("all");
  };
  const filtersActive =
    !!search ||
    moduleF !== "all" ||
    typeF !== "all" ||
    priorityF !== "all" ||
    statusF !== "all";

  const upcomingFuture = upcoming.filter((e) => e.date >= today);
  const upcomingPast = upcoming.filter((e) => e.date < today);

  return (
    <>
      <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
        <TabsList>
          <TabsTrigger value="all">All activity</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="month">This month</TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingFuture.length > 0 ? ` (${upcomingFuture.length})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "upcoming" ? (
        <div className="mt-6">
          <UpcomingList future={upcomingFuture} past={upcomingPast} />
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activity…"
                className="pl-9"
                aria-label="Search activity"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <FilterSelect
                value={moduleF}
                onChange={setModuleF}
                allLabel="All modules"
                options={moduleOptions.map((m) => ({
                  value: m,
                  label: moduleLabel(m),
                }))}
              />
              <FilterSelect
                value={typeF}
                onChange={setTypeF}
                allLabel="All types"
                options={ACTIVITY_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <FilterSelect
                value={priorityF}
                onChange={setPriorityF}
                allLabel="Any priority"
                options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              />
              <FilterSelect
                value={statusF}
                onChange={setStatusF}
                allLabel="Any status"
                options={STATUSES.map((s) => ({ value: s, label: nice(s) }))}
              />
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Feed */}
          <div className="mt-6 space-y-8">
            {groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <History className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {feed.length === 0
                    ? "No activity yet"
                    : "No matching activity"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feed.length === 0
                    ? "As you work across your modules, everything you do is recorded here."
                    : "Try clearing your filters or switching to All activity."}
                </p>
              </div>
            ) : (
              groups.map(([day, items]) => (
                <section key={day}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {day}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {items.map((x) => (
                      <ActivityCard
                        key={x.id}
                        item={x}
                        onOpen={() => setDetail(x)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}

      <ActivityDrawer
        detail={detail}
        canWrite={canWrite}
        onClose={() => setDetail(null)}
      />

      <p className="mt-6 text-[11px] text-muted-foreground">
        As of {fmtShort(today)}. Activity is recorded automatically as you use
        each module.
      </p>
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-36 text-xs capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActivityCard({
  item,
  onOpen,
}: {
  item: ActivityFeedItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:bg-muted/50"
    >
      <div className="mt-0.5 shrink-0">
        {item.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {item.title}
          </span>
          {item.priority !== "none" && (
            <Badge
              variant={priorityVariant[item.priority] ?? "outline"}
              className="shrink-0 capitalize"
            >
              {item.priority}
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.description}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="shrink-0">
            {moduleLabel(item.module)}
          </Badge>
          <span className="text-[11px] capitalize text-muted-foreground">
            {item.activityType}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {fmtTime(item.createdAt)}
          </span>
        </div>
      </div>
      <Badge
        variant={statusVariant[item.status] ?? "outline"}
        className="shrink-0 capitalize"
      >
        {nice(item.status)}
      </Badge>
    </button>
  );
}

function ActivityDrawer({
  detail,
  canWrite,
  onClose,
}: {
  detail: ActivityFeedItem | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markComplete() {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/activity/${detail.id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Marked complete");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!detail} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {detail && (
          <>
            <SheetHeader>
              <SheetTitle>{detail.title}</SheetTitle>
              <SheetDescription>
                {moduleLabel(detail.module)} · {detail.activityType}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4 text-sm">
              {detail.description && (
                <p className="text-foreground">{detail.description}</p>
              )}
              <dl className="space-y-3">
                <Field label="Status">
                  <Badge
                    variant={statusVariant[detail.status] ?? "outline"}
                    className="capitalize"
                  >
                    {nice(detail.status)}
                  </Badge>
                </Field>
                <Field label="Priority">
                  <span className="capitalize text-foreground">
                    {detail.priority}
                  </span>
                </Field>
                <Field label="When">
                  <span className="text-foreground">
                    {fmtShort(detail.createdAt)} at {fmtTime(detail.createdAt)}
                  </span>
                </Field>
                {detail.completedAt && (
                  <Field label="Completed">
                    <span className="text-foreground">
                      {fmtShort(detail.completedAt)} at{" "}
                      {fmtTime(detail.completedAt)}
                    </span>
                  </Field>
                )}
                {detail.dueAt && (
                  <Field label="Due">
                    <span className="text-foreground">
                      {fmtShort(detail.dueAt)}
                    </span>
                  </Field>
                )}
                <Field label="By">
                  <span className="text-foreground">
                    {detail.actorEmail ?? "System"}
                  </span>
                </Field>
                {detail.referenceType && (
                  <Field label="Reference">
                    <span className="text-foreground">
                      {nice(detail.referenceType)}
                      {detail.referenceId
                        ? ` · ${detail.referenceId.slice(0, 8)}`
                        : ""}
                    </span>
                  </Field>
                )}
              </dl>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={moduleRoute(detail.module)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  onClick={onClose}
                >
                  Open {moduleLabel(detail.module)}
                </Link>
                <Link
                  href={`/jova?q=${encodeURIComponent(`Tell me about "${detail.title}" in ${moduleLabel(detail.module)} and what I should do about it.`)}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={onClose}
                >
                  Ask Jova
                </Link>
                {canWrite && detail.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={markComplete}
                    disabled={busy}
                  >
                    Mark complete
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function UpcomingList({
  future,
  past,
}: {
  future: TimelineEvent[];
  past: TimelineEvent[];
}) {
  const Row = ({ e }: { e: TimelineEvent }) => (
    <Link
      href={e.href}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition hover:bg-muted/50"
    >
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {fmtShort(e.date)}
      </span>
      <Badge variant="outline" className="shrink-0">
        {moduleLabel(e.module)}
      </Badge>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {e.kind}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{e.title}</span>
    </Link>
  );

  if (future.length === 0 && past.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Clock className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">
          No dated events
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          As you add obligations, contracts, reviews and deadlines, their key
          dates appear here.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      {future.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upcoming ({future.length})
          </h2>
          <div className="space-y-1.5">
            {[...future].reverse().map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Past due dates ({past.length})
          </h2>
          <div className="space-y-1.5">
            {past.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
