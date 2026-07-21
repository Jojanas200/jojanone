import { DetailDrawer } from "./DetailDrawer";
import { Progress } from "@/components/ui/progress";
import type { BusinessSnapshot } from "@/data/types";

export function ScoreBreakdownDrawer({
  open,
  onOpenChange,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshot: BusinessSnapshot;
}) {
  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Business Confidence Score" description={`${snapshot.score}/100 - ${snapshot.status_label}`}>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{snapshot.explanation}</p>
      <div className="mt-6 space-y-4">
        {snapshot.factors.map((f) => (
          <div key={f.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-medium text-foreground">{f.label}</span>
              <span className="text-muted-foreground">{f.score}/100</span>
            </div>
            <Progress value={f.score} className="h-1.5" />
            <p className="mt-1 text-[12px] text-muted-foreground">{f.note}</p>
          </div>
        ))}
      </div>
    </DetailDrawer>
  );
}