import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCoreData, markActivityComplete } from "@/data/store";
import { formatDate } from "@/data/selectors";
import { MODULES } from "@/config/modules.config";
import { FilterBar } from "@/components/core/FilterBar";
import { ActivityCard } from "@/components/core/ActivityCard";
import { EmptyState } from "@/components/core/EmptyState";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { ActivityDetail } from "@/components/core/ActivityDetail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/timeline")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    a: typeof search.a === "string" ? search.a : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Timeline - Jojan One" },
      { name: "description", content: "Every event that shaped your business, in one place." },
    ],
  }),
  component: TimelinePage,
});

type ViewKey = "all" | "today" | "week" | "month";

function TimelinePage() {
  const activities = useCoreData((s) => s.activities);
  const { a } = Route.useSearch();
  const [detailId, setDetailId] = useState<string | null>(a ?? null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [module, setModule] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return activities
      .filter((x) => {
        if (view === "today") return new Date(x.created_at).getTime() >= dayStart.getTime();
        if (view === "week") return new Date(x.created_at).getTime() >= now - 7 * 86400000;
        if (view === "month") return new Date(x.created_at).getTime() >= now - 30 * 86400000;
        return true;
      })
      .filter((x) => module === "all" || x.module === module)
      .filter((x) => type === "all" || x.activity_type === type)
      .filter((x) => priority === "all" || x.priority === priority)
      .filter((x) => status === "all" || x.status === status)
      .filter((x) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q);
      })
      .sort((a1, b1) => new Date(b1.created_at).getTime() - new Date(a1.created_at).getTime());
  }, [activities, view, module, type, priority, status, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((x) => {
      const key = formatDate(x.created_at);
      const arr = map.get(key) ?? [];
      arr.push(x);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const detail = activities.find((x) => x.id === detailId) ?? null;

  const clear = () => {
    setSearch("");
    setModule("all");
    setType("all");
    setPriority("all");
    setStatus("all");
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Timeline</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Every event that shaped your business, in one place.
          </p>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All activity</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="month">This month</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          onClear={clear}
          placeholder="Search activities…"
          fields={[
            {
              key: "module",
              label: "Module",
              value: module,
              onChange: setModule,
              options: [
                { value: "all", label: "All modules" },
                ...MODULES.map((m) => ({ value: m.key, label: m.title })),
              ],
            },
            {
              key: "type",
              label: "Type",
              value: type,
              onChange: setType,
              options: [
                { value: "all", label: "All types" },
                ...["obligation", "filing", "review", "policy", "contract", "risk", "decision", "report", "system", "training", "meeting"].map(
                  (t) => ({ value: t, label: t }),
                ),
              ],
            },
            {
              key: "priority",
              label: "Priority",
              value: priority,
              onChange: setPriority,
              options: [
                { value: "all", label: "Any priority" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
                { value: "none", label: "None" },
              ],
            },
            {
              key: "status",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "all", label: "Any status" },
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In progress" },
                { value: "overdue", label: "Overdue" },
                { value: "upcoming", label: "Upcoming" },
                { value: "completed", label: "Completed" },
                { value: "info", label: "Info" },
              ],
            },
          ]}
        />
      </div>

      <div className="mt-6 space-y-8">
        {grouped.length === 0 ? (
          <EmptyState
            icon={History}
            title="No matching activity"
            description="Try clearing your filters or switching to All activity."
          />
        ) : (
          grouped.map(([date, items]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{date}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {items.map((x) => (
                  <ActivityCard key={x.id} activity={x} onOpen={() => setDetailId(x.id)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <DetailDrawer
        open={!!detail}
        onOpenChange={(v) => !v && setDetailId(null)}
        title={detail?.title ?? ""}
      >
        {detail && (
          <ActivityDetail
            activity={detail}
            onClose={() => setDetailId(null)}
            onComplete={() => {
              markActivityComplete(detail.id);
              toast.success("Marked complete");
              setDetailId(null);
            }}
          />
        )}
      </DetailDrawer>
    </div>
  );
}