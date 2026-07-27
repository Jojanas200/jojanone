"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CheckItem } from "@/shared/policies/check";

// The Jova Policy Check panel: the universal validation results, Jova's
// recommendations (kept beside the document, never inside it), and the
// check-gated adoption action.
export function JovaPolicyCheck({
  policyId,
  status,
  items,
  criticals,
  warnings,
  ready,
  recommendations,
  canWrite,
}: {
  policyId: string;
  status: string;
  items: CheckItem[];
  criticals: number;
  warnings: number;
  ready: boolean;
  recommendations: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [adopting, setAdopting] = useState(false);

  async function adopt() {
    setAdopting(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/adopt`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not adopt");
      toast.success("Policy adopted - now active with a version snapshot");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdopting(false);
    }
  }

  const icon = (s: CheckItem["status"]) =>
    s === "pass" ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
    ) : s === "warning" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
    ) : (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
    );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Jova Policy Check
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {criticals > 0 ? (
              <Badge variant="destructive">
                {criticals} critical issue{criticals === 1 ? "" : "s"}
              </Badge>
            ) : status === "active" ? (
              <Badge variant="success">Adopted</Badge>
            ) : (
              <Badge variant="success">Ready for adoption</Badge>
            )}
            {warnings > 0 && (
              <Badge variant="warning">{warnings} to review</Badge>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Critical issues must be resolved before adoption. Recommendations do
          not block adoption but should be reviewed.
        </p>
        <ul className="mt-4 space-y-2.5">
          {items.map((i) => (
            <li key={i.key} className="flex gap-2.5">
              {icon(i.status)}
              <div className="min-w-0">
                <p className="text-sm text-foreground">{i.label}</p>
                {i.detail && (
                  <p className="text-xs text-muted-foreground">{i.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canWrite && status === "draft" && (
            <Button onClick={adopt} disabled={!ready || adopting}>
              {adopting
                ? "Adopting…"
                : ready
                  ? "Adopt policy"
                  : "Resolve critical issues to adopt"}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={`/api/policies/${policyId}/export?format=pdf`}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              PDF{status === "active" ? "" : " (draft)"}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/policies/${policyId}/export?format=docx`}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              DOCX{status === "active" ? "" : " (draft)"}
            </a>
          </Button>
        </div>
        {status === "draft" && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Draft downloads are watermarked &quot;DRAFT - REVIEW BEFORE
            USE&quot;. Adopting finalises the wording, stamps the effective date
            and produces the clean download.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">
          Jova recommendations
        </h3>
        <p className="text-xs text-muted-foreground">
          Points to confirm or consider. These sit beside the policy and are
          never part of the adopted document.
        </p>
        {recommendations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No recommendations recorded for this document.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-foreground">{r}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
