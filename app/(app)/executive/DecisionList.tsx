"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingDecision } from "@/server/services/executive";

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

// Pending governance decisions with inline approve/defer, so sign-off can
// happen from the briefing without a round-trip through /governance.
export function DecisionList({
  decisions,
  canWrite,
}: {
  decisions: PendingDecision[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: "approved" | "deferred") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/governance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(status === "approved" ? "Approved" : "Deferred");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="divide-y divide-border/60">
      {decisions.map((d) => {
        const when = fmtDate(d.meetingDate);
        return (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{d.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <span className="capitalize">
                  {d.recordType.replace(/_/g, " ")}
                </span>
                {" · "}
                <span className="capitalize">{d.status}</span>
                {when ? ` · ${when}` : ""}
                {d.description ? ` · ${d.description}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">
                {d.status}
              </Badge>
              {canWrite && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setStatus(d.id, "approved")}
                    disabled={busyId === d.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setStatus(d.id, "deferred")}
                    disabled={busyId === d.id}
                  >
                    Defer
                  </Button>
                </>
              )}
              <Link
                href="/governance"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Review →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
