import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { policies, policyVersions } from "../db/schema";
import { recordActivity } from "./activity";
import { getBusinessProfile } from "./settings";
import { getActiveProvider, type LlmProvider } from "../ai/provider";
import {
  POLICY_TEMPLATES,
  getPolicyTemplate,
  kindOf,
  questionsFor,
  sectionsFor,
  type PolicyDocumentKind,
  type PolicyTemplate,
} from "../../shared/policies/templates";
import {
  finalisedContent,
  runPolicyCheck,
  type PolicyCheckResult,
} from "../../shared/policies/check";
import { remember } from "./jova-memory";
import type {
  CreatePolicyInput,
  DraftPolicyInput,
  UpdatePolicyInput,
} from "../../shared/schemas/policies";
import { composeFromTemplate } from "../../shared/policies/compose";

/** Company policy register. All queries run through withUser() (RLS). */

export function listPolicies(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(policies)
      .orderBy(
        sql`${policies.reviewDate} asc nulls last`,
        desc(policies.updatedAt),
      ),
  );
}

export function getPolicy(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(policies)
      .where(eq(policies.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function createPolicy(
  claims: UserClaims,
  workspaceId: string,
  input: CreatePolicyInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(policies)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        ...input,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "policies",
      action: "created",
      title: rows[0].policyName,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updatePolicy(
  claims: UserClaims,
  id: string,
  input: UpdatePolicyInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(policies)
      .set({ ...input, updatedBy: claims.sub, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "policies",
        action: "updated",
        title: row.policyName,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function setPolicyStatus(
  claims: UserClaims,
  id: string,
  status: string,
) {
  return withUser(claims, async (tx) => {
    // Capture the prior status so we only snapshot a version on a genuine
    // publish (transition INTO active), never on a re-publish of a live policy.
    const before = (
      await tx
        .select({ status: policies.status })
        .from(policies)
        .where(eq(policies.id, id))
        .limit(1)
    )[0];

    const rows = await tx
      .update(policies)
      .set({
        status,
        // Publishing (active) stamps the approval date if not already set.
        ...(status === "active"
          ? {
              approvalDate: sql`coalesce(${policies.approvalDate}, current_date)`,
            }
          : {}),
        updatedBy: claims.sub,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, id))
      .returning();
    const row = rows[0];
    if (row) {
      // Snapshot an immutable version when a policy is published.
      if (status === "active" && before && before.status !== "active") {
        await tx.insert(policyVersions).values({
          workspaceId: row.workspaceId,
          policyId: row.id,
          version: row.version,
          status: "active",
          policyName: row.policyName,
          content: row.content,
          createdBy: claims.sub,
        });
      }
      await recordActivity(tx, row.workspaceId, {
        module: "policies",
        action: status === "active" ? "completed" : "status changed",
        title: row.policyName,
        referenceId: row.id,
      });
    }
    return row ?? null;
  });
}

/** Immutable version history for a policy, newest first (RLS-scoped). */
export function listPolicyVersions(claims: UserClaims, policyId: string) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.policyId, policyId))
      .orderBy(desc(policyVersions.createdAt)),
  );
}

export function deletePolicy(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(policies)
      .where(eq(policies.id, id))
      .returning({ id: policies.id });
    return rows.length > 0;
  });
}

// --- Draft with Jova ---------------------------------------------------------
// Jova drafts a full policy document from a chosen template + the owner's guided
// answers (the first of which is the purpose), grounded in the business profile.
// Uses the active LLM provider when configured, and falls back to a
// deterministic section-by-section composition so it works with no model key.
// Always creates a DRAFT the user must review and adopt.

type BusinessProfile = Awaited<ReturnType<typeof getBusinessProfile>>;

const RECOMMENDATIONS_MARKER = "=== JOVA RECOMMENDATIONS ===";

const KIND_LABEL: Record<PolicyDocumentKind, string> = {
  policy: "policy",
  procedure: "procedure",
  plan: "plan",
  handbook: "handbook",
  notice: "letter or notice",
  statement: "formal record",
  contract: "contract template",
};

const POLICY_SYSTEM = `You are Jova, drafting a workplace document for a UK small business inside Jojan One. The document may be a policy, procedure, plan, handbook, letter, formal record or contract template - draft in the register that document type calls for.
Write a clear, practical, plain-English document the business can adopt after review. Requirements:
- Follow EXACTLY the numbered section headings you are given, in order. Do not add or drop sections.
- Weave the owner's guided answers into the relevant sections; expand them into complete, professional prose. Where an answer is missing, write a sensible, proportionate best-practice default for a small UK business - defaults for DRAFTING WORDING are encouraged (for contracts, use standard neutral drafting such as "as agreed in writing between the parties").
- Company facts are different: use ONLY the facts in the business context provided. Never invent or infer company-specific facts (directors, company structure, systems, suppliers, appointments, headcount beyond what is given). If a company fact is unknown, use neutral role-based wording such as "the business owner" or "the designated data protection lead".
- Never output bracketed placeholders such as [Business owner], [Name] or [Date]. Write real details from the context, or neutral role wording.
- Do not put advice or recommendations addressed to the business inside the document wording (nothing like "the business should assess whether..."). If there are points the business must confirm or consider before adopting, list them at the very end, one per line, after a line containing exactly: ${RECOMMENDATIONS_MARKER}
- Reference relevant UK frameworks only where genuinely applicable (for example UK GDPR and the Data Protection Act 2018 for data protection; ACAS guidance and the Employment Rights Act for HR; the Health and Safety at Work Act for health and safety). Do not make definitive legal determinations.
- Plain text only. No markdown, no tables.
- End the document body (before any recommendations) with one line stating this is a starting draft that should be reviewed by a qualified professional before adoption.`;

// Split a drafted document into policy wording and Jova's recommendations -
// advice lives BESIDE the document, never inside adopted wording.
function splitRecommendations(raw: string): {
  content: string;
  recommendations: string[];
} {
  const ix = raw.indexOf(RECOMMENDATIONS_MARKER);
  if (ix === -1) return { content: raw.trim(), recommendations: [] };
  const recommendations = raw
    .slice(ix + RECOMMENDATIONS_MARKER.length)
    .split("\n")
    .map((l) => l.replace(/^[-*\u2022\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return { content: raw.slice(0, ix).trim(), recommendations };
}

function businessBits(profile: BusinessProfile): string[] {
  const bits: string[] = [
    `Business name: ${profile?.businessName?.trim() || "the business"}`,
  ];
  if (profile?.industry) bits.push(`Sector: ${profile.industry}`);
  if (profile?.businessType) bits.push(`Type: ${profile.businessType}`);
  if (profile?.employeeCount) bits.push(`Employees: ${profile.employeeCount}`);
  if (profile?.contractorCount)
    bits.push(`Contractors: ${profile.contractorCount}`);
  if (profile?.processesPersonalData) bits.push("Processes personal data: yes");
  if (profile?.tradesInternationally) bits.push("Trades internationally: yes");
  return bits;
}

function buildPolicyPrompt(
  input: DraftPolicyInput,
  profile: BusinessProfile,
  template: PolicyTemplate | null,
): string {
  const questions = questionsFor(input.templateKey);
  const qa = questions
    .map((q) => {
      const a = (input.answers ?? {})[q.key]?.trim();
      return a ? `- ${q.question}\n  ${a}` : null;
    })
    .filter(Boolean)
    .join("\n");
  const kind = template?.kind ?? kindOf(input.templateKey);
  const headings = sectionsFor(input.templateKey)
    .map((s, i) => `${i + 1}. ${s.heading}`)
    .join("\n");
  return [
    `Draft a "${input.policyName}" ${KIND_LABEL[kind]}${
      input.policyCategory ? ` (category: ${input.policyCategory})` : ""
    }${template ? ` for the audience: ${template.audience}` : ""}.`,
    "",
    `Business context:\n${businessBits(profile).join("\n")}`,
    "",
    `Use these section headings, in this order:\n${headings}`,
    "",
    qa
      ? `The owner answered these guided questions - build the policy around them:\n${qa}`
      : "The owner did not provide guided answers; write proportionate defaults for a small UK business.",
  ].join("\n");
}

async function composePolicyContent(
  input: DraftPolicyInput,
  profile: BusinessProfile,
  template: PolicyTemplate | null,
  opts?: { provider?: LlmProvider },
): Promise<{
  content: string;
  recommendations: string[];
  draftedBy: string;
}> {
  const provider = opts?.provider ?? (await getActiveProvider());
  if (provider.isConfigured()) {
    try {
      const res = await provider.generate({
        system: POLICY_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildPolicyPrompt(input, profile, template),
          },
        ],
        maxTokens: 2200,
      });
      if (res.outcome === "answered" && res.text.trim().length > 0) {
        const split = splitRecommendations(res.text.trim());
        return { ...split, draftedBy: `${res.provider}/${res.model}` };
      }
    } catch {
      // Provider error - fall back to the deterministic composition below.
    }
  }
  return {
    content: composeFromTemplate(input, profile, template),
    recommendations: [],
    draftedBy: "template",
  };
}

// Approximately N months from today as a YYYY-MM-DD string (review date).
function monthsFromToday(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function draftPolicy(
  claims: UserClaims,
  workspaceId: string,
  input: DraftPolicyInput,
  opts?: { provider?: LlmProvider },
) {
  const template = getPolicyTemplate(input.templateKey);
  const profile = await getBusinessProfile(claims, workspaceId);
  const { content, recommendations, draftedBy } = await composePolicyContent(
    input,
    profile,
    template,
    opts,
  );

  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(policies)
      .values({
        workspaceId,
        policyName: input.policyName,
        policyCategory: input.policyCategory ?? template?.category ?? null,
        status: "draft",
        version: "0.1",
        content,
        jovaRecommendations: recommendations,
        reviewDate: monthsFromToday(template?.reviewMonths ?? 12),
        acknowledgementRequired: template?.requiresAcknowledgement ?? false,
        notes: `Drafted by Jova${
          template ? ` from the ${template.title} template` : ""
        } (${draftedBy}). Review and adapt before adopting.`,
        createdBy: claims.sub,
        updatedBy: claims.sub,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "policies",
      action: "created",
      title: rows[0].policyName,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

// --- Jova Policy Check + adoption --------------------------------------------
// One universal validation engine (shared/policies/check.ts) gates the move
// from draft to adopted: critical issues block adoption; recommendations are
// surfaced but never block. Adoption finalises the wording (draft disclaimer
// and stray advice stripped), stamps version/effective date, snapshots an
// immutable version and feeds the fact into Jova's memory.

function inferTemplateKey(policyName: string): string | null {
  const t = POLICY_TEMPLATES.find(
    (x) => x.title.toLowerCase() === policyName.trim().toLowerCase(),
  );
  return t?.key ?? null;
}

export async function checkPolicyById(claims: UserClaims, id: string) {
  const policy = await getPolicy(claims, id);
  if (!policy) return null;
  const check = runPolicyCheck(policy.content ?? "", {
    owner: policy.owner,
    reviewDate: policy.reviewDate,
    version: policy.version,
    templateKey: inferTemplateKey(policy.policyName),
    category: policy.policyCategory,
  });
  return { policy, check };
}

export async function adoptPolicy(
  claims: UserClaims,
  id: string,
): Promise<
  | {
      ok: true;
      policy: NonNullable<Awaited<ReturnType<typeof getPolicy>>>;
      check: PolicyCheckResult;
    }
  | { ok: false; check: PolicyCheckResult }
  | null
> {
  const res = await checkPolicyById(claims, id);
  if (!res) return null;
  const { policy, check } = res;
  if (!check.readyForAdoption) return { ok: false, check };

  const finalContent = finalisedContent(policy.content ?? "");
  const nextVersion = policy.version?.startsWith("0") ? "1.0" : policy.version;
  const row = await withUser(claims, async (tx) => {
    const rows = await tx
      .update(policies)
      .set({
        status: "active",
        content: finalContent,
        version: nextVersion,
        approvalDate: sql`coalesce(${policies.approvalDate}, current_date)`,
        adoptedAt: new Date(),
        updatedBy: claims.sub,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, id))
      .returning();
    const r = rows[0];
    if (r) {
      if (policy.status !== "active")
        await tx.insert(policyVersions).values({
          workspaceId: r.workspaceId,
          policyId: r.id,
          version: r.version,
          status: "active",
          policyName: r.policyName,
          content: r.content,
          createdBy: claims.sub,
        });
      await recordActivity(tx, r.workspaceId, {
        module: "policies",
        action: "completed",
        title: `${r.policyName} adopted`,
        referenceId: r.id,
      });
    }
    return r ?? null;
  });
  if (!row) return null;

  // Feed the adoption into Jova's semantic memory - best-effort.
  try {
    await remember(claims, row.workspaceId, {
      kind: "fact",
      sourceModule: "policies",
      refId: row.id,
      title: `Policy adopted: ${row.policyName}`,
      content: `${row.policyName} adopted as v${row.version}; owner ${
        row.owner ?? "not named"
      }; effective ${row.approvalDate ?? "today"}; next review ${
        row.reviewDate ?? "not set"
      }; status active.`,
    });
  } catch {
    // Memory is optional - adoption already succeeded.
  }
  return { ok: true, policy: row, check };
}
