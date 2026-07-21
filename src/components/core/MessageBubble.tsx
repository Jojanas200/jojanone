import type { JovaMessage } from "@/data/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/config/modules.config";
import { useNavigate } from "@tanstack/react-router";
import { Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { JovaMark } from "@/components/core/JovaMark";

export function MessageBubble({
  message,
  onAction,
  onOpenReference,
  onChoice,
}: {
  message: JovaMessage;
  onAction?: (msg: JovaMessage) => void;
  onOpenReference?: (msg: JovaMessage) => void;
  onChoice?: (prompt: string) => void;
}) {
  const isJova = message.sender === "jova";
  const navigate = useNavigate();
  return (
    <div className={cn("flex gap-3", isJova ? "justify-start" : "justify-end")}>
      {isJova && <JovaMark size={32} tone="soft" />}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
          isJova ? "bg-[oklch(0.98_0.005_260)] text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.structured?.metric && (
          <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-foreground">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {message.structured.metric.label}
            </div>
            <div className="text-[18px] font-semibold">{message.structured.metric.value}</div>
          </div>
        )}

        {message.structured?.factors && (
          <div className="mt-3 space-y-1 rounded-lg border border-border bg-background p-3 text-foreground">
            {message.structured.factors.map((f) => (
              <div key={f.label} className="flex items-center justify-between text-[13px]">
                <span>{f.label}</span>
                <span className="font-semibold">{f.score}/100</span>
              </div>
            ))}
          </div>
        )}

        {message.structured?.items && message.structured.items.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-lg border border-border bg-background p-3 text-foreground">
            {message.structured.items.map((it, i) => {
              const mod = it.module ? MODULES.find((m) => m.key === it.module) : null;
              return (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <div className="font-medium">{it.title}</div>
                    {(it.subtitle || mod) && (
                      <div className="text-[12px] text-muted-foreground">
                        {mod ? `${mod.title}` : ""}
                        {mod && it.subtitle ? " · " : ""}
                        {it.subtitle}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {message.structured?.disclaimer && (
          <p className={cn("mt-3 text-[11px]", isJova ? "text-muted-foreground" : "text-primary-foreground/70")}>
            {message.structured.disclaimer}
          </p>
        )}

        {isJova && message.structured?.choices && message.structured.choices.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {message.structured.choices.map((c, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                className="justify-start"
                onClick={() => onChoice?.(c.prompt)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        )}

        {isJova && (message.suggested_action || message.reference_id) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggested_action?.kind === "navigate" && message.suggested_action.target && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate({ to: message.suggested_action!.target! as never })
                }
              >
                {message.suggested_action.label} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
            {message.suggested_action?.kind === "generate_report" && onAction && (
              <Button size="sm" variant="outline" onClick={() => onAction(message)}>
                {message.suggested_action.label}
              </Button>
            )}
            {message.reference_type === "activity" && message.reference_id && onOpenReference && (
              <Button size="sm" variant="ghost" onClick={() => onOpenReference(message)}>
                Open referenced item
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(message.content);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}