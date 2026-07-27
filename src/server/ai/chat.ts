import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { conversations, jovaSources, messages } from "../db/schema";
import { retrieveContext, type RetrievedContext } from "./retrieval";
import { getActiveProvider, type LlmProvider } from "./provider";
import { getEmbedder } from "./embedder";
import { remember } from "../services/jova-memory";
import { getUserPrefs } from "../services/prefs";
import {
  searchTrusted,
  type WebSearchProvider,
  type WebSearchResult,
} from "./web-search";

// Jova chat. Retrieval → grounded model answer (with citations, refusal, and
// escalation) → deterministic fallback when the model is unavailable, refuses,
// or retrieval is empty. Every turn is persisted with full provenance
// (ai_provider, model_version, safety_decision, rules_version) and its source
// citations, so any answer is auditable and reproducible.

export const RULES_VERSION = "jova-rules-1";

const SYSTEM_PROMPT = `You are Jova, the business-protection assistant inside Jojan One, a UK small-business operating system.

Rules - follow all of them:
1. Answer ONLY using the CONTEXT below, which is the user's own workspace data. If the context does not contain the answer, say you don't have that information in their workspace - never invent facts, numbers, deadlines, or obligations.
2. You do NOT give regulated legal, tax, or financial ADVICE, and you do not make definitive legal/compliance determinations. If the user asks for that, do not attempt it: begin your reply with the token [ESCALATE] and recommend they get professional support, briefly explaining why.
3. Be concise and plain-English. Lead with the answer. Name the modules you drew on (e.g. "from your Risk register").
4. The CONTEXT includes the workspace's actual registers (contracts, risks, people, HR actions, obligations, GDPR records, governance, policies, evidence, tenders, due diligence, business relationships). Quote the specific records, dates, owners and terms from them when they answer the question - do not fall back to module scores when record detail is present.
5. Format with simple Markdown: short headings, **bold** for key facts, and bullet lists. No tables.
6. This is guidance based on the user's data, not professional advice.`;

export type SafetyDecision = "answered" | "refused" | "escalate";

export interface AskResult {
  conversationId: string;
  answer: string;
  mode: "model" | "deterministic";
  provider: string | null;
  model: string | null;
  safetyDecision: SafetyDecision;
  sources: { module: string; label: string; url?: string | null }[];
}

export interface AskInput {
  question: string;
  conversationId?: string | null;
  attachment?: { name: string; content: string; truncated?: boolean } | null;
}

// Deterministic answer from retrieved context - the launch engine. Grounded,
// reproducible, no model. Used when AI is unconfigured, refuses, or errors.
function deterministicAnswer(ctx: RetrievedContext): string {
  if (ctx.findingCount === 0) {
    return `Your Business Confidence Score is ${ctx.score}/100 and nothing needs your attention right now - all areas are in good standing. This is guidance based on your data, not professional advice.`;
  }
  const top = ctx.sources
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.label} (${s.module})`);
  return `Your Business Confidence Score is ${ctx.score}/100. Based on your workspace, the top things to address are:\n${top.join(
    "\n",
  )}\n\nOpen the relevant module to act on each. This is guidance based on your data, not professional advice.`;
}

async function loadHistory(claims: UserClaims, conversationId: string) {
  return withUser(claims, (tx) =>
    tx
      .select({ sender: messages.sender, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt)),
  );
}

export async function ask(
  claims: UserClaims,
  workspaceId: string,
  input: AskInput,
  opts?: { provider?: LlmProvider; webSearch?: WebSearchProvider },
): Promise<AskResult> {
  const provider = opts?.provider ?? (await getActiveProvider());
  const ctx = await retrieveContext(claims, workspaceId, input.question);

  // Controlled, read-only web search of trusted official sources. Flag-gated
  // (off by default) and redacted before any query leaves the platform; a
  // failure or empty result never affects the answer.
  let webResults: WebSearchResult[] = [];
  try {
    const web = await searchTrusted(workspaceId, input.question, {
      provider: opts?.webSearch,
    });
    webResults = web.results;
  } catch {
    webResults = [];
  }
  if (webResults.length > 0) {
    ctx.contextText +=
      `\n\n## Web sources (controlled read-only search of trusted official sites)\n` +
      webResults
        .map(
          (r, i) =>
            `[W${i + 1}] ${r.title} - ${r.publisher} (${r.url}) accessed ${r.accessedAt}\n${r.snippet}`,
        )
        .join("\n");
    for (const r of webResults)
      ctx.sources.push({
        module: "web",
        refId: null,
        label: `${r.publisher}: ${r.title}`,
        url: r.url,
      });
  }

  // A file attached to the question joins the grounded context and is cited
  // like any other source.
  if (input.attachment) {
    ctx.contextText += `\n\n## Attached document: ${input.attachment.name}${
      input.attachment.truncated ? " (truncated)" : ""
    }\n${input.attachment.content}`;
    ctx.sources.unshift({
      module: "attachment",
      refId: null,
      label: input.attachment.name,
    });
  }

  // The user's saved response-style preference shapes the system prompt.
  const webRules =
    webResults.length > 0
      ? "\nWeb-source rules: the CONTEXT includes numbered Web sources from a controlled, read-only search of trusted official sites. When you use one, name the publisher and include its link, and keep sourced facts clearly separate from your own explanation. If the web sources do not verify a claim, say it cannot be verified from them. You cannot browse further, submit forms or take any external action."
      : "";
  const { jovaStyle } = await getUserPrefs(claims);
  const styleLine =
    jovaStyle === "detailed"
      ? "\n5. This user prefers DETAILED answers: expand with the relevant surrounding context from their workspace data, not just the headline."
      : "";

  // Prior turns (if continuing a conversation), oldest first.
  const history = input.conversationId
    ? await loadHistory(claims, input.conversationId)
    : [];

  let answer = "";
  let mode: "model" | "deterministic" = "deterministic";
  let safety: SafetyDecision = "answered";
  let usedProvider: string | null = null;
  let usedModel: string | null = null;

  if (provider.isConfigured() && ctx) {
    try {
      const result = await provider.generate({
        system: `${SYSTEM_PROMPT}${styleLine}${webRules}\n\nCONTEXT:\n${ctx.contextText}`,
        messages: [
          ...history.map((h) => ({
            role:
              h.sender === "jova" ? ("assistant" as const) : ("user" as const),
            content: h.content,
          })),
          { role: "user" as const, content: input.question },
        ],
        maxTokens: 1024,
      });
      if (result.outcome === "refused") {
        answer = deterministicAnswer(ctx);
        safety = "refused";
        mode = "deterministic";
      } else if (result.text.trim() === "") {
        answer = deterministicAnswer(ctx);
        mode = "deterministic";
      } else {
        let text = result.text;
        if (text.startsWith("[ESCALATE]")) {
          safety = "escalate";
          text = text.slice("[ESCALATE]".length).trim();
        }
        answer = text;
        mode = "model";
        usedProvider = result.provider;
        usedModel = result.model;
      }
    } catch {
      // Provider error → deterministic fallback (never fail the request).
      answer = deterministicAnswer(ctx);
      mode = "deterministic";
    }
  } else {
    answer = deterministicAnswer(ctx);
    if (input.attachment)
      answer += `\n\nNote: I could not analyse the attached file "${input.attachment.name}" because AI answering is not configured for this workspace.`;
  }

  // Persist the turn (user + assistant) with provenance + citations.
  const conversationId = await withUser(claims, async (tx) => {
    let convId = input.conversationId ?? null;
    if (!convId) {
      const rows = await tx
        .insert(conversations)
        .values({
          workspaceId,
          title: input.question.slice(0, 80),
          createdBy: claims.sub,
        })
        .returning({ id: conversations.id });
      convId = rows[0].id;
    } else {
      await tx
        .update(conversations)
        .set({ updatedAt: sql`now()` })
        .where(eq(conversations.id, convId));
    }

    await tx.insert(messages).values({
      workspaceId,
      conversationId: convId,
      sender: "user",
      content: input.attachment
        ? `${input.question}\n\n[Attached file: ${input.attachment.name}]`
        : input.question,
    });

    const asstRows = await tx
      .insert(messages)
      .values({
        workspaceId,
        conversationId: convId,
        sender: "jova",
        content: answer,
        rulesVersion: RULES_VERSION,
        aiProvider: usedProvider,
        modelVersion: usedModel,
        safetyDecision: safety,
      })
      .returning({ id: messages.id });
    const messageId = asstRows[0].id;

    if (ctx.sources.length > 0) {
      await tx.insert(jovaSources).values(
        ctx.sources.slice(0, 20).map((s) => ({
          workspaceId,
          messageId,
          sourceModule: s.module,
          note: s.label,
          url: s.url ?? null,
        })),
      );
    }

    return convId;
  });

  // Remember this exchange so Jova can recall it in future turns. Best-effort
  // and only when embeddings are active (the model is already warm from recall)
  // - a failure here must never affect the answer.
  const embedder = getEmbedder();
  if (await embedder.isAvailable()) {
    try {
      await remember(
        claims,
        workspaceId,
        {
          kind: "interaction",
          title: input.question.slice(0, 80),
          content: `Q: ${input.question}\nA: ${answer}`,
          sourceModule: "jova",
          refId: conversationId,
        },
        embedder,
      );
    } catch {
      // memory is optional
    }
  }

  // De-duplicate the citation list for display (web sources stay distinct
  // per link so every internet-supported answer shows its provenance).
  const seen = new Set<string>();
  const sources = ctx.sources
    .filter((s) => {
      const key = s.module === "web" ? `web:${s.url}` : s.module;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({ module: s.module, label: s.label, url: s.url ?? null }));

  return {
    conversationId,
    answer,
    mode,
    provider: usedProvider,
    model: usedModel,
    safetyDecision: safety,
    sources,
  };
}

/** The workspace's conversations, most-recently-updated first (RLS-scoped). */
export function listConversations(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(50),
  );
}

/** Delete a conversation (messages + sources cascade). Returns true if removed. */
export function deleteConversation(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id });
    return rows.length > 0;
  });
}

/** Read a conversation's turns (RLS-scoped). */
export function listConversationMessages(
  claims: UserClaims,
  conversationId: string,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({
        id: messages.id,
        sender: messages.sender,
        content: messages.content,
        safetyDecision: messages.safetyDecision,
        aiProvider: messages.aiProvider,
        modelVersion: messages.modelVersion,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId)))
      .orderBy(asc(messages.createdAt));
    if (rows.length === 0) return [];
    // Rehydrate stored citations so sources survive a conversation reload.
    const cites = await tx
      .select({
        messageId: jovaSources.messageId,
        module: jovaSources.sourceModule,
        label: jovaSources.note,
        url: jovaSources.url,
      })
      .from(jovaSources)
      .where(
        inArray(
          jovaSources.messageId,
          rows.map((r) => r.id),
        ),
      );
    const byMessage = new Map<string, { module: string; label: string }[]>();
    for (const c of cites) {
      const arr = byMessage.get(c.messageId) ?? [];
      arr.push({ module: c.module, label: c.label ?? "" });
      byMessage.set(c.messageId, arr);
    }
    return rows.map((r) => ({ ...r, sources: byMessage.get(r.id) ?? [] }));
  });
}
