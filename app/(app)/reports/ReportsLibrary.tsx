"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type LibraryReport = {
  id: string;
  reportType: string;
  title: string;
  reportingPeriod: string | null;
  status: string;
  summary: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  executive_summary: "Executive Summary",
  business_confidence: "Business Confidence",
  compliance_overview: "Compliance Overview",
  risk_summary: "Risk Summary",
  monthly_activity: "Monthly Activity",
  training_summary: "Training and Learning",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function ReportsLibrary({
  reports,
  canWrite,
}: {
  reports: LibraryReport[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [time, setTime] = useState("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const now = Date.now();
    const windows: Record<string, number> = {
      "7": 7 * 864e5,
      "30": 30 * 864e5,
      "90": 90 * 864e5,
    };
    return reports.filter((r) => {
      if (type !== "all" && r.reportType !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (time !== "all") {
        const win = windows[time];
        if (win && now - new Date(r.createdAt).getTime() > win) return false;
      }
      if (
        query &&
        !`${r.title} ${r.summary ?? ""}`.toLowerCase().includes(query)
      )
        return false;
      return true;
    });
  }, [reports, q, type, status, time]);

  async function rename(r: LibraryReport) {
    const title = window.prompt("Rename report", r.title)?.trim();
    if (!title || title === r.title) return;
    const res = await fetch(`/api/reports/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      toast.success("Renamed");
      router.refresh();
    } else toast.error("Could not rename");
  }

  async function duplicate(r: LibraryReport) {
    const res = await fetch(`/api/reports/${r.id}/duplicate`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Duplicated");
      router.refresh();
    } else toast.error("Could not duplicate");
  }

  async function remove(r: LibraryReport) {
    if (!window.confirm(`Delete "${r.title}"?`)) return;
    const res = await fetch(`/api/reports/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      router.refresh();
    } else toast.error("Could not delete");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports..."
          className="h-9 max-w-xs flex-1"
        />
        <FilterSelect
          value={type}
          onChange={setType}
          all="All types"
          options={Object.entries(TYPE_LABEL).map(([v, l]) => ({
            value: v,
            label: l,
          }))}
        />
        <FilterSelect
          value={time}
          onChange={setTime}
          all="Any time"
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          all="Any status"
          options={[
            { value: "final", label: "Final" },
            { value: "draft", label: "Draft" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {reports.length === 0
            ? "No reports yet. Generate one above to build your library."
            : "No reports match your filters."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Link
                  href={`/reports/${r.id}`}
                  className="text-sm font-semibold text-foreground hover:underline"
                >
                  {r.title}
                </Link>
                {canWrite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/reports/${r.id}`)}
                      >
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => rename(r)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicate(r)}>
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => remove(r)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABEL[r.reportType] ?? r.reportType}
                {r.reportingPeriod ? ` · ${r.reportingPeriod}` : ""}
              </p>
              {r.summary ? (
                <p className="mt-2 line-clamp-2 flex-1 text-xs text-muted-foreground">
                  {r.summary}
                </p>
              ) : (
                <div className="flex-1" />
              )}
              <div className="mt-3 flex items-center justify-between">
                <Badge
                  variant={r.status === "final" ? "secondary" : "outline"}
                  className="text-[10px] capitalize"
                >
                  {r.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(r.createdAt)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
