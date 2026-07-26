"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileBarChart, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TenderReadiness = {
  readinessScore: number;
  policyScore: number;
  evidenceScore: number;
  insuranceOk: boolean;
  gdprOk: boolean;
  complianceOk: boolean;
  metrics: {
    activeOpps: number;
    bidPending: number;
    deadlines30: number;
    reqIncomplete: number;
    responsesToReview: number;
  };
  gaps: string[];
};

const bandVariant = (n: number): "secondary" | "outline" | "destructive" =>
  n >= 80 ? "secondary" : n >= 50 ? "outline" : "destructive";
const bandLabel = (n: number) =>
  n >= 80 ? "Tender ready" : n >= 50 ? "Getting there" : "Not ready";

export function TenderReadinessHeader({
  readiness,
  canWrite,
}: {
  readiness: TenderReadiness;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [assessOpen, setAssessOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const r = readiness;
  const tiles = [
    { label: "Active opportunities", value: r.metrics.activeOpps },
    { label: "Bid pending", value: r.metrics.bidPending },
    { label: "Deadlines ≤30d", value: r.metrics.deadlines30 },
    { label: "Requirements incomplete", value: r.metrics.reqIncomplete },
    { label: "Responses to review", value: r.metrics.responsesToReview },
  ];

  async function generateReport() {
    setReporting(true);
    try {
      const res = await fetch("/api/tender/report", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      toast.success("Tender Readiness Report generated");
      router.push(`/reports/${data.report.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReporting(false);
    }
  }

  return (
    <>
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Tender readiness score
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {r.readinessScore}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Policies {r.policyScore} · Evidence {r.evidenceScore}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={bandVariant(r.readinessScore)}>
              {bandLabel(r.readinessScore)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssessOpen(true)}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Run readiness assessment
            </Button>
            {canWrite && (
              <Button size="sm" onClick={generateReport} disabled={reporting}>
                <FileBarChart className="mr-1.5 h-4 w-4" />
                {reporting ? "Generating…" : "Generate report"}
              </Button>
            )}
          </div>
        </div>
        <Progress value={r.readinessScore} className="mt-4" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-border p-3">
              <p className="text-xl font-semibold text-foreground">{t.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={assessOpen} onOpenChange={setAssessOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tender readiness assessment</DialogTitle>
            <DialogDescription>
              A deterministic assessment based on your recorded policies,
              evidence, compliance and GDPR position.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Readiness score" value={`${r.readinessScore}/100`} />
            <Row label="Policies" value={`${r.policyScore}/100`} />
            <Row label="Evidence" value={`${r.evidenceScore}/100`} />
            <Row
              label="Insurance"
              value={r.insuranceOk ? "Current" : "Attention"}
            />
            <Row label="GDPR" value={r.gdprOk ? "OK" : "Below threshold"} />
            <Row
              label="Compliance"
              value={r.complianceOk ? "On track" : "Overdue items"}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Gaps and next steps
            </p>
            {r.gaps.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No material gaps recorded.
              </p>
            ) : (
              <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                {r.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setAssessOpen(false)}>Close</Button>
          </DialogFooter>
          <p className="text-[11px] text-muted-foreground">
            The platform records readiness; it does not submit tenders
            externally, and this is guidance, not professional advice.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
