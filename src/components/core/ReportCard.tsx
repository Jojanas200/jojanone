import type { Report } from "@/data/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/data/selectors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FileText, MoreVertical } from "lucide-react";
import { StatusPill } from "./StatusPill";

const REPORT_LABEL: Record<string, string> = {
  executive_summary: "Executive Summary",
  business_confidence: "Confidence Report",
  compliance_overview: "Compliance",
  risk_summary: "Risk",
  monthly_activity: "Monthly Activity",
  training_summary: "Training & Learning",
};

export function ReportCard({
  report,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  report: Report;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[oklch(0.955_0.05_264)]">
          <FileText className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">{report.title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {REPORT_LABEL[report.report_type] ?? report.report_type} · {report.reporting_period}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="line-clamp-2 text-[13px] text-muted-foreground">{report.summary}</p>
      <div className="flex items-center justify-between">
        <StatusPill tone={report.status === "final" ? "success" : "neutral"}>{report.status}</StatusPill>
        <span className="text-[12px] text-muted-foreground">{formatDate(report.created_at)}</span>
      </div>
    </div>
  );
}

export { REPORT_LABEL };