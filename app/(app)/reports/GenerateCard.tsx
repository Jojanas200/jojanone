"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIODS = [
  "Current month",
  "Last month",
  "Current quarter",
  "Last quarter",
  "Year to date",
];

export type CatalogItem = {
  key: string;
  title: string;
  description: string;
  sources: string[];
  includes: string[];
};

export function GenerateCard({ meta }: { meta: CatalogItem }) {
  const router = useRouter();
  const [period, setPeriod] = useState(PERIODS[2]);
  const [busy, setBusy] = useState(false);
  const [include, setInclude] = useState({
    summary: true,
    metrics: true,
    findings: true,
    actions: true,
  });
  const anySection = Object.values(include).some(Boolean);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: meta.key, period, include }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      const { report } = (await res.json()) as { report: { id: string } };
      toast.success("Report generated");
      router.push(`/reports/${report.id}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col p-5">
      <p className="text-sm font-semibold text-foreground">{meta.title}</p>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">
        {meta.description}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-medium text-muted-foreground">Sources</p>
          <p className="text-foreground">{meta.sources.join(", ")}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Includes</p>
          <p className="text-foreground">{meta.includes.join(", ")}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {(
          [
            ["summary", "Summary"],
            ["metrics", "Metrics"],
            ["findings", "Findings"],
            ["actions", "Actions"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <input
              type="checkbox"
              checked={include[key]}
              onChange={(e) =>
                setInclude((p) => ({ ...p, [key]: e.target.checked }))
              }
              className="h-3.5 w-3.5 rounded border-input"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={busy || !anySection}
          onClick={generate}
          title={anySection ? undefined : "Select at least one section"}
        >
          {busy ? "Generating..." : "Generate report"}
        </Button>
      </div>
    </Card>
  );
}
