import type { UserClaims } from "../db";
import { getSnapshot } from "../services/dashboard";
import { getJovaBriefing } from "../services/jova";
import { getBusinessProfile } from "../services/settings";

// Retrieval for the AI layer. Assembles a grounded context block from the
// caller's workspace ONLY - every source query runs through an RLS-scoped
// service (getSnapshot / getJovaBriefing / getBusinessProfile), so retrieval
// can never surface another tenant's data. The model is instructed to answer
// only from this context (see the system prompt in chat.ts).

export interface RetrievedSource {
  module: string;
  refId: string | null;
  label: string;
}

export interface RetrievedContext {
  contextText: string;
  sources: RetrievedSource[];
  score: number;
  findingCount: number;
}

export async function retrieveContext(
  claims: UserClaims,
  workspaceId: string,
): Promise<RetrievedContext> {
  const [snapshot, briefing, profile] = await Promise.all([
    getSnapshot(claims),
    getJovaBriefing(claims),
    getBusinessProfile(claims, workspaceId),
  ]);

  const sources: RetrievedSource[] = [];
  const lines: string[] = [];

  lines.push(`## Business`);
  lines.push(
    `Name: ${profile?.businessName?.trim() || "Not set"}. Type: ${
      profile?.businessType ?? "unknown"
    }. Industry: ${profile?.industry ?? "unknown"}. Profile completion: ${
      profile?.profileCompletion ?? 0
    }%.`,
  );

  lines.push(``);
  lines.push(
    `## Business Confidence Score: ${snapshot.score}/100 (${snapshot.statusLabel})`,
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

  return {
    contextText: lines.join("\n"),
    sources,
    score: snapshot.score,
    findingCount: briefing.total,
  };
}
