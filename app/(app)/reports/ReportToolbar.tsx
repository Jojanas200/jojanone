"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type SnapshotPayload = {
  title: string;
  summary: string;
  metrics: { label: string; value: number }[];
  findings: string[];
  sourceModules: string[];
};

export function ReportToolbar({ snapshot }: { snapshot: SnapshotPayload }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "executive_summary",
          title: snapshot.title,
          reportingPeriod: new Date().toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          }),
          summary: snapshot.summary,
          metrics: snapshot.metrics,
          findings: snapshot.findings,
          sourceModules: snapshot.sourceModules,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Snapshot saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save snapshot"}
      </Button>
    </div>
  );
}
