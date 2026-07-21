import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Send, PanelLeft } from "lucide-react";
import { JovaMark } from "@/components/core/JovaMark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCoreData,
  createConversation,
  appendMessage,
  clearConversation,
  deleteConversation,
  addReport,
} from "@/data/store";
import { generateJovaReply, SUGGESTED_PROMPTS } from "@/data/jova-engine";
import { computeSnapshot, formatRelative } from "@/data/selectors";
import { MessageBubble } from "@/components/core/MessageBubble";
import { ConversationListItem } from "@/components/core/ConversationListItem";
import { EmptyState } from "@/components/core/EmptyState";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import type { JovaMessage } from "@/data/types";
import { toast } from "sonner";

export const Route = createFileRoute("/jova")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search.c === "string" ? search.c : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Jova - Jojan One" },
      { name: "description", content: "Your always-on business protection intelligence." },
    ],
  }),
  component: JovaPage,
});

function JovaPage() {
  const state = useCoreData((s) => s);
  const { c } = Route.useSearch();
  const navigate = useNavigate();

  const [activeId, setActiveId] = useState<string | null>(c ?? state.conversations[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const generatingFor = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (c && c !== activeId) setActiveId(c);
  }, [c]);

  useEffect(() => {
    if (!activeId && state.conversations[0]) setActiveId(state.conversations[0].id);
  }, [activeId, state.conversations]);

  const messages = useMemo(
    () => state.messages.filter((m) => m.conversation_id === activeId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [state.messages, activeId],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  // Auto-generate a Jova reply for any trailing user message that has no reply yet
  // (e.g. contextual "Ask Jova" flows that only append the user question).
  useEffect(() => {
    if (!activeId) return;
    const last = messages[messages.length - 1];
    if (!last || last.sender !== "user") return;
    if (generatingFor.current.has(last.id)) return;
    generatingFor.current.add(last.id);
    setThinking(true);
    setTimeout(() => {
      try {
        // Inherit conversation context: if this user message has no reference,
        // walk back through prior messages in the same conversation to pick up
        // the most recent reference so short follow-ups stay on-topic.
        let refType = last.reference_type;
        let refId = last.reference_id;
        if (!refType) {
          for (let i = messages.length - 2; i >= 0; i--) {
            const m = messages[i];
            if (m.reference_type && m.reference_id) {
              refType = m.reference_type;
              refId = m.reference_id;
              break;
            }
          }
        }
        const reply = generateJovaReply(state, last.content, {
          reference_type: refType,
          reference_id: refId,
        });
        appendMessage({
          conversation_id: activeId,
          ...reply,
          reference_type: reply.reference_type ?? refType,
          reference_id: reply.reference_id ?? refId,
        });
      } catch {
        appendMessage({
          conversation_id: activeId,
          sender: "jova",
          content: "Jova could not prepare this explanation. Please try again.",
          reference_type: last.reference_type,
          reference_id: last.reference_id,
          suggested_action: null,
        });
      } finally {
        setThinking(false);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, messages.length]);

  const send = (text: string) => {
    if (!text.trim()) return;
    let convId = activeId;
    if (!convId) {
      convId = createConversation(text.slice(0, 60));
      setActiveId(convId);
    } else {
      // Rename empty conversations to the first user prompt
      const existing = state.messages.filter((m) => m.conversation_id === convId);
      if (existing.length === 0) {
        // rename via createConversation logic bypassed; just leave - updated_at will refresh
      }
    }
    appendMessage({
      conversation_id: convId,
      sender: "user",
      content: text,
      reference_type: null,
      reference_id: null,
      suggested_action: null,
    });
    setInput("");
    // The auto-response effect handles reply generation for the appended user message.
  };

  const newConversation = () => {
    const id = createConversation("New conversation");
    setActiveId(id);
    navigate({ to: "/jova", search: { c: id } });
  };

  const handleAction = (msg: JovaMessage) => {
    if (msg.suggested_action?.kind === "generate_report" && msg.suggested_action.target === "executive_summary") {
      const snap = computeSnapshot(state);
      const id = addReport({
        report_type: "executive_summary",
        title: `Executive Summary - ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
        reporting_period: "Last 90 days",
        summary: `Overall position ${snap.status_label} (${snap.score}/100). ${snap.open_priorities} open priorities, ${snap.overdue_actions} overdue.`,
        metrics: [
          { label: "Confidence Score", value: `${snap.score}/100` },
          { label: "Open priorities", value: String(snap.open_priorities) },
          { label: "Overdue", value: String(snap.overdue_actions) },
          { label: "Completed this month", value: String(snap.completed_this_month) },
        ],
        findings: state.activities.filter((a) => a.priority === "high").map((a) => a.title),
        priority_actions: state.activities.filter((a) => a.priority === "high" && a.status !== "completed").map((a) => a.title),
        sections: [
          { heading: "Overall position", body: snap.explanation },
          { heading: "Compliance", body: state.areas.find((a) => a.key === "compliance")!.summary },
          { heading: "Risk", body: state.areas.find((a) => a.key === "risk")!.summary },
        ],
        source_modules: ["compliance", "risk", "hr", "governance", "contracts", "gdpr"],
      });
      toast.success("Executive Report generated");
      navigate({ to: "/reports", search: { r: id } });
    }
  };

  const activeConv = state.conversations.find((cv) => cv.id === activeId);

  const isNewConversation = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Sidebar */}
      <aside
        className={cn(
          "border-b border-border bg-[color-mix(in_oklab,var(--jova-glow)_4%,var(--card))] lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r",
          !sidebarOpen && "hidden lg:block",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="jova-orb" aria-hidden />
            <span className="text-[13px] font-semibold text-foreground">Conversations</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={newConversation}
            className="h-7 gap-1 border-[color-mix(in_oklab,var(--jova-glow)_35%,var(--border))] bg-card text-[12px]"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
        <div className="px-2 pb-3">
          {state.conversations.length === 0 && (
            <p className="px-3 py-4 text-[12px] text-muted-foreground">No conversations yet.</p>
          )}
          {state.conversations.map((cv) => (
            <ConversationListItem
              key={cv.id}
              conversation={cv}
              active={cv.id === activeId}
              onSelect={() => {
                setActiveId(cv.id);
                navigate({ to: "/jova", search: { c: cv.id } });
              }}
              onDelete={() => {
                deleteConversation(cv.id);
                if (cv.id === activeId) setActiveId(null);
                toast.success("Conversation deleted");
              }}
            />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 lg:hidden"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Toggle conversations"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <JovaMark size={36} tone="soft" />
              <div className="min-w-0">
                {isNewConversation ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="jova-orb" aria-hidden />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Jova is ready
                      </span>
                    </div>
                    <h1 className="font-display mt-1 text-[26px] leading-tight text-foreground">
                      What would you like to understand today?
                    </h1>
                    <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
                      Ask about your business, priorities, risks, obligations, reports or learning.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold text-foreground">
                      {activeConv?.title ?? "New conversation"}
                    </p>
                    {activeConv && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Updated {formatRelative(activeConv.updated_at)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            {activeConv && messages.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onAction={handleAction} onChoice={(p) => send(p)} />
          ))}
          {thinking && (
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
              <JovaMark size={32} tone="soft" />
              <span className="jova-orb" aria-hidden />
              <span>Jova is thinking…</span>
            </div>
          )}
        </div>

        {/* Suggested prompts */}
        {messages.length === 0 && (
          <div className="border-t border-border bg-[color-mix(in_oklab,var(--jova-glow)_3%,var(--card))] px-6 py-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full border border-[color-mix(in_oklab,var(--jova-glow)_30%,var(--border))] bg-card px-3.5 py-1.5 text-[12px] text-foreground shadow-[var(--shadow-xs)] transition-colors hover:bg-[color-mix(in_oklab,var(--jova-glow)_10%,var(--card))]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="sticky bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-end gap-2 rounded-xl border border-[color-mix(in_oklab,var(--jova-glow)_20%,var(--border))] bg-card p-2 shadow-[var(--shadow-sm)] focus-within:border-[color-mix(in_oklab,var(--jova-glow)_45%,var(--border))]">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask Jova about your business…"
              className="min-h-[52px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              rows={2}
            />
            <Button
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              size="icon"
              aria-label="Send message"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear conversation?"
        description="This removes all messages in this conversation."
        destructive
        confirmLabel="Clear"
        onConfirm={() => {
          if (activeId) {
            clearConversation(activeId);
            toast.success("Conversation cleared");
          }
        }}
      />
    </div>
  );
}