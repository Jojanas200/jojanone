"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { JovaMarkdown } from "./JovaMarkdown";

export type Conversation = { id: string; title: string; updatedAt: string };

type Turn = {
  role: "user" | "jova";
  text: string;
  attachmentName?: string;
  mode?: "model" | "deterministic";
  provider?: string | null;
  safety?: "answered" | "refused" | "escalate";
  sources?: { module: string; label: string; url?: string | null }[];
};

const MODULE_ROUTE: Record<string, string> = {
  evidence: "/evidence",
  "business-map": "/business-map",
  compliance: "/compliance",
  contracts: "/contracts",
  risk: "/risk",
  hr: "/hr",
  gdpr: "/gdpr",
  governance: "/governance",
  policies: "/policies",
  "tender-ready": "/tender-ready",
  "investor-ready": "/investor-ready",
  academy: "/academy",
};

const MODULE_LABEL: Record<string, string> = {
  evidence: "Evidence",
  "business-map": "Business Map",
  attachment: "Attachment",
  compliance: "Compliance",
  contracts: "Contracts",
  risk: "Risk",
  hr: "HR",
  gdpr: "GDPR",
  governance: "Governance",
  policies: "Policies",
  "tender-ready": "Tender",
  "investor-ready": "Investor",
  academy: "Academy",
  memory: "Memory",
};

const SUGGESTIONS = [
  "What should I focus on first?",
  "Do I have anything overdue?",
  "What's my biggest risk right now?",
  "How is my Business Confidence Score calculated?",
  "Which contracts are expiring soon?",
  "Are my right-to-work checks up to date?",
  "Where are my GDPR gaps?",
  "Do I have any open data subject requests?",
  "What decisions are waiting for sign-off?",
  "How ready am I for investor due diligence?",
  "How ready am I to bid for tenders?",
  "What training should my team do next?",
  "Which policies are due for review?",
  "What changed in my business this week?",
  "What would improve my score the fastest?",
  "Summarise my compliance position",
];

// Copy answers as normal text: markdown syntax stripped, bullets kept.
const plainText = (md: string) =>
  md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "\u2022 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();

const relTime = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

export function JovaChat({
  initialConversations,
  webSearchEnabled = false,
}: {
  initialConversations: Conversation[];
  webSearchEnabled?: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<{
    name: string;
    text: string;
    truncated: boolean;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function attachFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/jova/attachments", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not read the file");
      setAttachment(data.attachment);
      toast.success(`Attached ${data.attachment.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const [loading, setLoading] = useState(false);

  // "Ask Jova about this" deep links (/jova?q=...) pre-fill the composer so
  // the question arrives with its record context; the user just hits send.
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setInput(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshList() {
    const data = await fetch("/api/jova/conversations")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (data?.conversations) setConversations(data.conversations);
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setLoading(true);
    setTurns([]);
    try {
      const data = await fetch(`/api/jova/conversations/${id}`).then((r) =>
        r.json(),
      );
      type Msg = {
        sender: string;
        content: string;
        safetyDecision: Turn["safety"];
        aiProvider: string | null;
        sources?: { module: string; label: string }[];
      };
      setTurns(
        (data.messages ?? []).map((m: Msg) => ({
          role: m.sender === "jova" ? "jova" : "user",
          text: m.content,
          safety: m.safetyDecision,
          provider: m.aiProvider,
          mode: m.aiProvider ? "model" : "deterministic",
          sources: m.sources,
        })),
      );
    } catch {
      toast.error("Could not open conversation");
    } finally {
      setLoading(false);
    }
  }

  function newConversation() {
    setActiveId(null);
    setTurns([]);
    setInput("");
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const att = attachment;
    setInput("");
    setAttachment(null);
    setTurns((t) => [
      ...t,
      { role: "user", text: q, attachmentName: att?.name },
    ]);
    setBusy(true);
    try {
      const res = await fetch("/api/jova/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          conversationId: activeId,
          attachment: att
            ? { name: att.name, content: att.text, truncated: att.truncated }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      const r = data.result;
      setActiveId(r.conversationId);
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
      await refreshList();
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

  async function removeConversation(id: string) {
    if (!window.confirm("Delete this conversation?")) return;
    const res = await fetch(`/api/jova/conversations/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConversations((c) => c.filter((x) => x.id !== id));
      if (activeId === id) newConversation();
      toast.success("Conversation deleted");
    } else toast.error("Could not delete");
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* Conversations sidebar */}
      <aside className="flex flex-col gap-2">
        <Button size="sm" className="w-full" onClick={newConversation}>
          <Plus className="mr-1.5 h-4 w-4" />
          New conversation
        </Button>
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li
              key={c.id}
              className={`group flex items-center rounded-lg text-sm ${
                activeId === c.id ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className="min-w-0 flex-1 px-3 py-2 text-left"
              >
                <span className="block truncate text-foreground">
                  {c.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {relTime(c.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                aria-label="Delete conversation"
                onClick={() => removeConversation(c.id)}
                className="mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {conversations.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              No conversations yet.
            </li>
          )}
        </ul>
      </aside>

      {/* Chat pane */}
      <div className="flex min-h-[420px] flex-col">
        <div className="flex-1 space-y-3">
          {turns.length === 0 && !loading && (
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
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <p className="text-sm text-muted-foreground">
              Loading conversation…
            </p>
          )}

          <ul className="space-y-3">
            {turns.map((t, i) => (
              <li
                key={i}
                className={t.role === "user" ? "flex justify-end" : ""}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    t.role === "user"
                      ? "bg-foreground text-background"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {t.role === "jova" ? (
                    <JovaMarkdown text={t.text} />
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{t.text}</p>
                      {t.attachmentName && (
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-background/20 px-2 py-0.5 text-[11px]">
                          <Paperclip className="h-3 w-3" />
                          {t.attachmentName}
                        </p>
                      )}
                    </>
                  )}
                  {t.role === "jova" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                      {t.safety === "escalate" && (
                        <Badge variant="destructive">Escalated</Badge>
                      )}
                      {[
                        ...new Map(
                          (t.sources ?? []).map((s) => [
                            s.module === "web" ? `web:${s.url}` : s.module,
                            s,
                          ]),
                        ).values(),
                      ].map((s) =>
                        s.module === "web" && s.url ? (
                          <a
                            key={`web:${s.url}`}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            title={s.label}
                          >
                            <Badge variant="secondary">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              {s.label.split(":")[0]}
                            </Badge>
                          </a>
                        ) : MODULE_ROUTE[s.module] ? (
                          <Link
                            key={s.module}
                            href={MODULE_ROUTE[s.module]}
                            title={s.label || undefined}
                          >
                            <Badge
                              variant="outline"
                              className="transition hover:border-foreground/40"
                            >
                              {MODULE_LABEL[s.module] ?? s.module} →
                            </Badge>
                          </Link>
                        ) : (
                          <Badge key={s.module} variant="outline">
                            {MODULE_LABEL[s.module] ?? s.module}
                          </Badge>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            t.role === "jova" ? plainText(t.text) : t.text,
                          );
                          toast.success("Copied");
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
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
        </div>

        {attachment && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground">
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              {attachment.name}
              {attachment.truncated ? " (long file - first part attached)" : ""}
            </span>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
              className="ml-auto text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-4 flex items-end gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void attachFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Attach a file"
            title="Attach a file (PDF, DOCX, TXT, CSV)"
            disabled={uploading || busy}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Ask Jova about your business…"
            aria-label="Ask Jova"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none"
          />
          <Button type="submit" disabled={busy || !input.trim()}>
            Send
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Jova answers from your workspace data
          {webSearchEnabled
            ? " and controlled read-only searches of trusted official sources (GOV.UK, ICO, HSE and similar), always citing the publisher, link and date"
            : ""}{" "}
          and won&apos;t give regulated legal or financial advice. Guidance, not
          advice.
        </p>
      </div>
    </div>
  );
}
