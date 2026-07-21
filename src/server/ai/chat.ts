import { and, asc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { conversations, jovaSources, messages } from "../db/schema";
import { retrieveContext, type RetrievedContext } from "./retrieval";
import { getActiveProvider, type LlmProvider } from "./provider";

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
4. This is guidance based on the user's data, not professional advice.`;

export type SafetyDecision = "answered" | "refused" | "escalate";

export interface AskResult {
  conversationId: string;
  answer: string;
  mode: "model" | "deterministic";
  provider: string | null;
  model: string | null;
  safetyDecision: SafetyDecision;
  sources: { module: string; label: string }[];
}

export interface AskInput {
  question: string;
  conversationId?: string | null;
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
  opts?: { provider?: LlmProvider },
): Promise<AskResult> {
  const provider = opts?.provider ?? (await getActiveProvider());
  const ctx = await retrieveContext(claims, workspaceId);

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
        system: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${ctx.contextText}`,
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
      content: input.question,
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
        })),
      );
    }

    return convId;
  });

  // De-duplicate the citation list for display.
  const seen = new Set<string>();
  const sources = ctx.sources
    .filter((s) => {
      if (seen.has(s.module)) return false;
      seen.add(s.module);
      return true;
    })
    .map((s) => ({ module: s.module, label: s.label }));

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

/** Read a conversation's turns (RLS-scoped). */
export function listConversationMessages(
  claims: UserClaims,
  conversationId: string,
) {
  return withUser(claims, (tx) =>
    tx
      .select({
        sender: messages.sender,
        content: messages.content,
        safetyDecision: messages.safetyDecision,
        aiProvider: messages.aiProvider,
        modelVersion: messages.modelVersion,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId)))
      .orderBy(asc(messages.createdAt)),
  );
}
