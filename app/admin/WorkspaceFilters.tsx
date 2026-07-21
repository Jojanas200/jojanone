"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const STATUSES = ["trialing", "active", "past_due", "canceled"];

// Server-driven tenant filters. Updates the /admin query string (which the
// server page reads for queryPlatformWorkspaces). Search is debounced; selects
// apply immediately. Any change resets to page 1.
export function WorkspaceFilters({
  current,
  plans,
}: {
  current: {
    search?: string;
    status?: string;
    plan?: string;
    suspended?: string;
    sort?: string;
  };
  plans: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(current.search ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(next: Record<string, string | undefined>) {
    const merged = { ...current, ...next };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    qs.delete("page"); // reset pagination on any filter change
    router.push(qs.toString() ? `/admin?${qs.toString()}` : "/admin");
  }

  // Debounced search.
  useEffect(() => {
    if (search === (current.search ?? "")) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () => push({ search: search || undefined }),
      350,
    );
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search workspace or organisation…"
        className="h-8 w-full sm:w-64"
      />
      <Select
        value={current.status ?? ALL}
        onValueChange={(v) => push({ status: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={current.plan ?? ALL}
        onValueChange={(v) => push({ plan: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All plans</SelectItem>
          {plans.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={current.suspended ?? ALL}
        onValueChange={(v) => push({ suspended: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any state</SelectItem>
          <SelectItem value="no">Active only</SelectItem>
          <SelectItem value="yes">Suspended only</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={current.sort ?? "newest"}
        onValueChange={(v) => push({ sort: v === "newest" ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="name">Name</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
