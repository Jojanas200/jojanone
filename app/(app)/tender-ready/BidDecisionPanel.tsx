"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  TENDER_BID_CHECKLIST,
  TENDER_DIMENSIONS,
} from "@/shared/schemas/tender-readiness";
import { nice } from "../_shared/format";

type Assessment = {
  answers: Record<string, unknown>;
  overallScore: number;
  recommendation: string;
  decision: string;
  decisionReason: string | null;
} | null;

const recVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  bid: "secondary",
  conditional: "outline",
  no_bid: "destructive",
};

export function BidDecisionPanel({
  assessment,
  canWrite,
}: {
  assessment: Assessment;
  canWrite: boolean;
}) {
  const router = useRouter();
  const initial = (assessment?.answers ?? {}) as Record<string, boolean>;
  const [answers, setAnswers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      TENDER_BID_CHECKLIST.map((q) => [q.key, !!initial[q.key]]),
    ),
  );
  const [reason, setReason] = useState(assessment?.decisionReason ?? "");
  const [saving, setSaving] = useState(false);

  const dimScore = useMemo(
    () =>
      TENDER_DIMENSIONS.map((d) => {
        const items = TENDER_BID_CHECKLIST.filter((q) => q.dim === d);
        const met = items.filter((q) => answers[q.key]).length;
        return { dim: d, score: Math.round((met / items.length) * 100) };
      }),
    [answers],
  );
  const overall = useMemo(
    () =>
      Math.round(dimScore.reduce((s, d) => s + d.score, 0) / dimScore.length),
    [dimScore],
  );
  const recommendation =
    overall >= 60 ? "bid" : overall >= 40 ? "conditional" : "no_bid";

  async function save(decision?: "bid" | "no_bid") {
    setSaving(true);
    try {
      const res = await fetch("/api/tender/bid-assessment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          ...(decision ? { decision } : {}),
          decisionReason: reason || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(decision ? "Decision recorded" : "Assessment saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Bid fit score</p>
            <p className="text-3xl font-semibold text-foreground">{overall}%</p>
          </div>
          <div className="text-right">
            <Badge variant={recVariant[recommendation]}>
              Recommend: {nice(recommendation)}
            </Badge>
            {assessment && assessment.decision !== "pending" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Decision: {nice(assessment.decision)}
              </p>
            )}
          </div>
        </div>
        <Progress value={overall} className="mt-4" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dimScore.map((d) => (
            <div key={d.dim} className="rounded-lg border border-border p-2">
              <p className="text-sm font-semibold text-foreground">
                {d.score}%
              </p>
              <p className="text-[11px] capitalize text-muted-foreground">
                {nice(d.dim)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {TENDER_DIMENSIONS.map((d) => (
        <div key={d}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {nice(d)}
          </h3>
          <Card className="divide-y divide-border p-0">
            {TENDER_BID_CHECKLIST.filter((q) => q.dim === d).map((q) => (
              <div
                key={q.key}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <span className="text-sm text-foreground">{q.label}</span>
                <Switch
                  checked={!!answers[q.key]}
                  disabled={!canWrite}
                  onCheckedChange={(v) =>
                    setAnswers((p) => ({ ...p, [q.key]: v === true }))
                  }
                />
              </div>
            ))}
          </Card>
        </div>
      ))}

      {canWrite && (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-medium text-foreground">Decision</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason for the bid / no-bid decision…"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => save()}
              disabled={saving}
            >
              Save assessment
            </Button>
            <Button size="sm" onClick={() => save("bid")} disabled={saving}>
              Record: Bid
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => save("no_bid")}
              disabled={saving}
            >
              Record: No bid
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
