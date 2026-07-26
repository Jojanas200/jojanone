"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { printDocument } from "../_shared/print";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ExecReportPayload = {
  title: string;
  summary: string;
  metrics: { label: string; value: string }[];
  findings: string[];
  priorityActions: string[];
  sourceModules: string[];
};

const PERIODS = [
  { value: "Current quarter", label: "Current quarter" },
  { value: "Last quarter", label: "Last quarter" },
  { value: "Year to date", label: "Year to date" },
  { value: "Last 12 months", label: "Last 12 months" },
];

// Generates an executive report from the live position and saves it to the
// Reports library (reportType: executive_summary), then opens Reports.
export function GenerateExecutiveReport({
  payload,
}: {
  payload: ExecReportPayload;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(PERIODS[0].value);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "executive_summary",
          reportingPeriod: period,
          ...payload,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Executive report generated");
      router.push("/reports");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={generate} disabled={busy}>
        {busy ? "Generating..." : "Generate Executive Report"}
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          printDocument({
            title: payload.title,
            meta: `Executive summary · ${period}`,
            blocks: [
              { kind: "text", heading: "Position", body: payload.summary },
              {
                kind: "rows",
                heading: "Key metrics",
                rows: payload.metrics.map((m) => [m.label, m.value]),
              },
              ...(payload.findings.length > 0
                ? [
                    {
                      kind: "list" as const,
                      heading: "Findings",
                      items: payload.findings,
                    },
                  ]
                : []),
              ...(payload.priorityActions.length > 0
                ? [
                    {
                      kind: "list" as const,
                      heading: "Priority actions",
                      items: payload.priorityActions,
                    },
                  ]
                : []),
            ],
            disclaimer: "Guidance based on your data, not professional advice.",
          })
        }
      >
        Preview / print
      </Button>
    </div>
  );
}
