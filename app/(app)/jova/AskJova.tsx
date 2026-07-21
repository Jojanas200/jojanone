"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Turn = {
  role: "user" | "jova";
  text: string;
  mode?: "model" | "deterministic";
  provider?: string | null;
  safety?: "answered" | "refused" | "escalate";
  sources?: { module: string; label: string }[];
};

const MODULE_LABEL: Record<string, string> = {
  compliance: "Compliance",
  contracts: "Contracts",
  risk: "Risk",
  hr: "HR",
  gdpr: "GDPR",
  governance: "Governance",
  "tender-ready": "Tender",
  "investor-ready": "Investor",
  academy: "Academy",
  Settings: "Settings",
};

const SUGGESTIONS = [
  "What should I focus on first?",
  "What's my biggest risk right now?",
  "Do I have anything overdue?",
];

export function AskJova() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | null>(null);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/jova/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          conversationId: conversationId.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      const r = data.result;
      conversationId.current = r.conversationId;
      setTurns((t) => [
        ...t,
        {
          role: "jova",
          text: r.answer,
          mode: r.mode,
          provider: r.provider,
          safety: r.safetyDecision,
          sources: r.sources,
        },
      ]);
    } catch (err) {
      toast.error((err as Error).message);
      setTurns((t) => [
        ...t,
        { role: "jova", text: "Sorry - I couldn't answer that just now." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {turns.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ask Jova about your business. Answers are grounded in your own
            workspace data.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {turns.map((t, i) => (
          <li key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                t.role === "user"
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{t.text}</p>
              {t.role === "jova" && (t.sources?.length || t.mode) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                  {t.safety === "escalate" && (
                    <Badge variant="destructive">Escalated</Badge>
                  )}
                  {t.sources?.map((s) => (
                    <Badge key={s.module} variant="outline">
                      {MODULE_LABEL[s.module] ?? s.module}
                    </Badge>
                  ))}
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t.mode === "model"
                      ? `${t.provider ?? "ai"}`
                      : "deterministic"}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
        {busy && (
          <li>
            <div className="inline-block rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
              Jova is thinking…
            </div>
          </li>
        )}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Jova about your business…"
          aria-label="Ask Jova"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Ask
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        Jova answers only from your workspace data and won&apos;t give regulated
        legal or financial advice - it will point you to professional support
        instead. Guidance, not advice.
      </p>
    </div>
  );
}
