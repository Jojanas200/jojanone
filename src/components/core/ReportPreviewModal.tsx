import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Report } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Printer, MessageSquare, X } from "lucide-react";
import { formatDate } from "@/data/selectors";
import { useCoreData } from "@/data/store";
import { REPORT_LABEL } from "./ReportCard";
import { BrandLogo } from "./BrandLogo";

export function ReportPreviewModal({
  report,
  open,
  onOpenChange,
  onAskJova,
}: {
  report: Report | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAskJova?: (r: Report) => void;
}) {
  const business = useCoreData((s) => s.business);
  const settings = useCoreData((s) => s.app_settings);
  const includeLogo = settings?.report_defaults?.include_logo ?? true;
  const logo = settings?.branding?.logo_data_url ?? null;
  const displayName = settings?.branding?.display_name || business.name;
  if (!report) return null;

  const handlePrint = () => {
    const el = document.getElementById(`report-print-${report.id}`);
    if (!el) return window.print();
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return window.print();
    win.document.write(`<!doctype html><html><head><title>${report.title}</title>
      <style>
        body{font-family:Inter,system-ui,sans-serif;color:#1B2A4A;padding:40px;max-width:820px;margin:0 auto;line-height:1.5}
        h1{font-size:24px;margin:0 0 8px}
        h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #E5E7EB;padding-bottom:4px}
        h3{font-size:14px;margin:16px 0 4px}
        .meta{color:#6B7280;font-size:13px;margin-bottom:24px}
        .brand{color:#2563EB;font-weight:600;letter-spacing:.02em;font-size:12px;text-transform:uppercase}
        .brand-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
        .brand-row img{max-height:48px;max-width:180px;object-fit:contain}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:16px 0}
        .metric{border:1px solid #E5E7EB;border-radius:8px;padding:12px}
        .metric .l{color:#6B7280;font-size:12px}
        .metric .v{font-size:20px;font-weight:600;margin-top:4px}
        ul{margin:6px 0 0 18px;padding:0} li{margin:2px 0;font-size:13px}
        p{font-size:13px}
        .disclaimer{margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;color:#6B7280;font-size:11px}
      </style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <DialogTitle className="text-[15px]">{report.title}</DialogTitle>
          <div className="flex items-center gap-2">
            {onAskJova && (
              <Button size="sm" variant="outline" onClick={() => onAskJova(report)}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div id={`report-print-${report.id}`} className="px-8 py-6">
          {includeLogo && (
            <div className="brand-row mb-2 flex items-center gap-3">
              {logo ? (
                <img
                  src={logo}
                  alt={`${displayName} logo`}
                  style={{ maxHeight: 48, maxWidth: 180, objectFit: "contain" }}
                />
              ) : (
                <BrandLogo variant="print" />
              )}
            </div>
          )}
          <div className="brand text-[11px] font-semibold uppercase tracking-wider text-primary">Jojan One</div>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-foreground">{report.title}</h1>
          <p className="meta mt-2 text-[13px] text-muted-foreground">
            {business.name} · {REPORT_LABEL[report.report_type]} · {report.reporting_period} · Generated {formatDate(report.created_at)}
          </p>

          <h2 className="mt-6 border-b border-border pb-1 text-[15px] font-semibold">Executive summary</h2>
          <p className="mt-2 text-[13px] leading-relaxed">{report.summary}</p>

          {report.metrics.length > 0 && (
            <>
              <h2 className="mt-6 border-b border-border pb-1 text-[15px] font-semibold">Key metrics</h2>
              <div className="grid mt-3 grid-cols-2 gap-3">
                {report.metrics.map((m) => (
                  <div key={m.label} className="metric rounded-lg border border-border p-3">
                    <div className="l text-[12px] text-muted-foreground">{m.label}</div>
                    <div className="v mt-1 text-[20px] font-semibold">{m.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {report.findings.length > 0 && (
            <>
              <h2 className="mt-6 border-b border-border pb-1 text-[15px] font-semibold">Findings</h2>
              <ul className="mt-2 list-disc pl-5 text-[13px]">
                {report.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </>
          )}

          {report.priority_actions.length > 0 && (
            <>
              <h2 className="mt-6 border-b border-border pb-1 text-[15px] font-semibold">Priority actions</h2>
              <ul className="mt-2 list-disc pl-5 text-[13px]">
                {report.priority_actions.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </>
          )}

          {report.sections.map((sec) => (
            <div key={sec.heading}>
              <h2 className="mt-6 border-b border-border pb-1 text-[15px] font-semibold">{sec.heading}</h2>
              <p className="mt-2 text-[13px] leading-relaxed">{sec.body}</p>
              {sec.bullets && (
                <ul className="mt-2 list-disc pl-5 text-[13px]">
                  {sec.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <h2 className="mt-6 border-b border-border pb-1 text-[15px] font-semibold">Source modules</h2>
          <p className="mt-2 text-[13px] capitalize">{report.source_modules.join(" · ")}</p>

          <p className="disclaimer mt-8 border-t border-border pt-3 text-[11px] text-muted-foreground">
            This report was generated by Jojan One using data recorded in your account. It provides business information and guidance, not legal advice. Where professional judgement is required, please consult a qualified adviser.
          </p>
        </div>

      </DialogContent>
    </Dialog>
  );
}