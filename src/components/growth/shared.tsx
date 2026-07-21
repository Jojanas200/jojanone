import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { DDStatus, DataRoomStatus, TenderStatus, TenderResponseStatus } from "@/data/types";

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ReadinessScoreCard({ score, label, hint, onDetails }: { score: number; label: string; hint?: string; onDetails?: () => void }) {
  const tone: Tone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
  return (
    <Card className="border border-border bg-card p-5 shadow-none">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <StatusPill tone={tone}>{score >= 80 ? "Ready" : score >= 60 ? "Nearly ready" : "Needs work"}</StatusPill>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-[36px] font-semibold leading-none text-foreground">{score}</span>
        <span className="mb-1 text-[14px] text-muted-foreground">/ 100</span>
      </div>
      <Progress value={score} className="mt-3 h-1.5" />
      {hint && <p className="mt-2 text-[12px] text-muted-foreground">{hint}</p>}
      {onDetails && (
        <Button variant="ghost" size="sm" className="mt-3 h-8 justify-start p-0 text-primary" onClick={onDetails}>
          How is this calculated?
        </Button>
      )}
    </Card>
  );
}

export function ReadinessBreakdown({ scores, onOpen }: { scores: Array<{ label: string; score: number; note: string; category: string }>; onOpen?: (category: string) => void }) {
  return (
    <div className="space-y-3">
      {scores.map((s) => (
        <div key={s.category}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <button type="button" className={cn("font-medium text-foreground", onOpen && "hover:text-primary")} onClick={() => onOpen?.(s.category)}>
              {s.label}
            </button>
            <span className="text-muted-foreground">{s.score}/100</span>
          </div>
          <Progress value={s.score} className="h-1.5" />
          <p className="mt-1 text-[12px] text-muted-foreground">{s.note}</p>
        </div>
      ))}
    </div>
  );
}

export function ddStatusTone(s: DDStatus): Tone {
  if (s === "ready") return "success";
  if (s === "not_applicable") return "neutral";
  if (s === "needs_review") return "warning";
  if (s === "in_progress") return "info";
  return "danger";
}
export function drStatusTone(s: DataRoomStatus): Tone {
  if (s === "ready") return "success";
  if (s === "archived") return "neutral";
  if (s === "needs_review") return "warning";
  if (s === "in_progress") return "info";
  return "danger";
}
export function tenderStatusTone(s: TenderStatus): Tone {
  if (s === "won" || s === "submitted") return "success";
  if (s === "no_bid" || s === "lost" || s === "archived") return "neutral";
  if (s === "bid" || s === "drafting" || s === "review") return "warning";
  return "info";
}
export function responseStatusTone(s: TenderResponseStatus): Tone {
  if (s === "approved") return "success";
  if (s === "ready_for_review") return "warning";
  if (s === "in_progress") return "info";
  return "neutral";
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] text-foreground">{value ?? "-"}</div>
    </div>
  );
}

export function formatCurrency(n: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function printHtml(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=960,height=1000");
  if (!win) { window.print(); return; }
  win.document.write(`<!doctype html><html><head><title>${title}</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;color:#1B2A4A;padding:40px;max-width:840px;margin:0 auto;line-height:1.5}
    h1{font-size:24px;margin:0 0 8px}
    h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #E5E7EB;padding-bottom:4px}
    h3{font-size:14px;margin:16px 0 6px}
    .meta{color:#6B7280;font-size:13px;margin-bottom:24px}
    .brand{color:#2563EB;font-weight:600;letter-spacing:.02em;font-size:12px;text-transform:uppercase}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:12px 0}
    .metric{border:1px solid #E5E7EB;border-radius:8px;padding:12px}
    .metric .l{color:#6B7280;font-size:12px}
    .metric .v{font-size:20px;font-weight:600;margin-top:4px}
    ul{margin:6px 0 0 18px;padding:0}
    li{margin:2px 0;font-size:13px}
    p{font-size:13px}
    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
    th,td{border:1px solid #E5E7EB;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#F3F4F6;font-weight:600}
    .disclaimer{margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;color:#6B7280;font-size:11px}
  </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 200);
}

export const investorDisclaimer =
  "Jojan One helps organise investor-readiness and due-diligence information. It does not provide investment, valuation, tax, financial or legal advice and does not guarantee that funding will be secured.";

export const tenderDisclaimer =
  "Jojan One helps organise tender-readiness, evidence and bid information. It does not guarantee eligibility, compliance, tender acceptance or contract award. Final submissions should be reviewed by appropriately qualified personnel.";
