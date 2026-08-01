import type { UserClaims } from "../db";
import { getSnapshot } from "../services/dashboard";
import { getJovaBriefing } from "../services/jova";
import { getBusinessProfile } from "../services/settings";
import { recall } from "../services/jova-memory";
import { collectModuleRecords } from "./records";

// Retrieval for the AI layer. Assembles a grounded context block from the
// caller's workspace ONLY - every source query runs through an RLS-scoped
// service (getSnapshot / getJovaBriefing / getBusinessProfile), so retrieval
// can never surface another tenant's data. The model is instructed to answer
// only from this context (see the system prompt in chat.ts).

export interface RetrievedSource {
  module: string;
  refId: string | null;
  label: string;
  url?: string | null;
}

export interface RetrievedContext {
  contextText: string;
  sources: RetrievedSource[];
  /** null while the Business Confidence assessment is pending. */
  score: number | null;
  findingCount: number;
}

export async function retrieveContext(
  claims: UserClaims,
  workspaceId: string,
  query?: string,
): Promise<RetrievedContext> {
  const [snapshot, briefing, profile, records] = await Promise.all([
    getSnapshot(claims),
    getJovaBriefing(claims),
    getBusinessProfile(claims, workspaceId),
    collectModuleRecords(claims, query),
  ]);

  const sources: RetrievedSource[] = [];
  const lines: string[] = [];

  lines.push(`## Business`);
  lines.push(
    `Name: ${profile?.businessName?.trim() || "Not set"}. Type: ${
      profile?.businessType ?? "unknown"
    }. Industry: ${profile?.industry ?? "unknown"}. Registered country: ${
      profile?.registeredCountry?.trim() || "not set"
    }. Profile completion: ${profile?.profileCompletion ?? 0}%.`,
  );

  lines.push(``);
  lines.push(
    snapshot.score === null
      ? `## Business Confidence Score: assessment pending - onboarding is ${snapshot.onboarding.percent}% complete and there is not yet enough information to score this business. Do not invent or estimate a score.`
      : `## Business Confidence Score: ${snapshot.score}/100 (${snapshot.statusLabel})`,
  );
  for (const a of snapshot.areas) {
    lines.push(`- ${a.label}: ${a.score}/100 - ${a.note}`);
  }

  lines.push(``);
  lines.push(`## Key metrics`);
  lines.push(
    `Overdue obligations: ${snapshot.metrics.overdueObligations}; action required: ${snapshot.metrics.actionRequired}; open risks: ${snapshot.metrics.openRisks} (critical/high: ${snapshot.metrics.criticalHighRisks}); people gaps: ${snapshot.metrics.peopleGaps}; contracts expiring: ${snapshot.metrics.expiringContracts}.`,
  );

  lines.push(``);
  lines.push(`## Findings (${briefing.total})`);
  for (const f of briefing.findings.slice(0, 20)) {
    lines.push(
      `- [${f.severity.toUpperCase()}] (${f.module}) ${f.title} - ${f.explanation} Action: ${f.action}`,
    );
    sources.push({ module: f.module, refId: f.id, label: f.title });
  }
  if (briefing.total === 0) {
    lines.push(`- No outstanding findings; the business is in good standing.`);
  }

  // The actual registers: record-level detail from every module (RLS-scoped),
  // ranked against the question so relevant records survive the caps.
  for (const block of records) {
    lines.push(``);
    lines.push(
      `## ${block.heading} (${
        block.lines.length < block.total
          ? `showing ${block.lines.length} most relevant of ${block.total}`
          : `${block.total} record${block.total === 1 ? "" : "s"}`
      })`,
    );
    for (const l of block.lines) {
      lines.push(`- ${l.text}`);
      sources.push({ module: l.module, refId: l.refId, label: l.label });
    }
  }

  // Semantic memory: recall facts/past interactions relevant to the question.
  // Best-effort - empty (and silent) when embeddings aren't configured.
  if (query?.trim()) {
    try {
      const memories = await recall(claims, query, {
        k: 5,
        minSimilarity: 0.2,
        workspaceId,
      });
      if (memories.length > 0) {
        lines.push(``);
        lines.push(`## Relevant memory`);
        for (const m of memories) {
          lines.push(`- ${m.title ? `${m.title}: ` : ""}${m.content}`);
          sources.push({
            module: m.sourceModule ?? "memory",
            refId: m.id,
            label: m.title ?? "Memory",
          });
        }
      }
    } catch {
      // Memory is optional - never fail retrieval on it.
    }
  }

  return {
    contextText: lines.join("\n"),
    sources,
    score: snapshot.score,
    findingCount: briefing.total,
  };
}
