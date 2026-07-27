import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { policies, policyVersions } from "../db/schema";
import { recordActivity } from "./activity";
import { getBusinessProfile } from "./settings";
import { getActiveProvider, type LlmProvider } from "../ai/provider";
import {
  POLICY_SECTIONS,
  getPolicyTemplate,
  questionsFor,
  type PolicyTemplate,
} from "../../shared/policies/templates";
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

const POLICY_SYSTEM = `You are Jova, drafting a workplace policy for a UK small business inside Jojan One.
Write a clear, practical, plain-English policy the business can adopt after review. Requirements:
- Follow EXACTLY the numbered section headings you are given, in order. Do not add or drop sections.
- Weave the owner's guided answers into the relevant sections; expand them into complete, professional prose. Where an answer is missing, write a sensible, proportionate default for a small UK business.
- Ground it in the business context provided (name, sector, size). Do not invent facts you were not given.
- Reference relevant UK frameworks only where genuinely applicable (for example UK GDPR and the Data Protection Act 2018 for data protection; ACAS guidance and the Employment Rights Act for HR; the Health and Safety at Work Act for health and safety). Do not make definitive legal determinations.
- Plain text only. No markdown, no tables. Use "[Business owner]" where a named policy owner is needed.
- End with one line stating this is a starting draft that should be reviewed by a qualified professional before adoption.`;

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
  const headings = POLICY_SECTIONS.map((s, i) => `${i + 1}. ${s.heading}`).join(
    "\n",
  );
  return [
    `Draft a "${input.policyName}" policy${
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
): Promise<{ content: string; draftedBy: string }> {
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
      if (res.outcome === "answered" && res.text.trim().length > 0)
        return {
          content: res.text.trim(),
          draftedBy: `${res.provider}/${res.model}`,
        };
    } catch {
      // Provider error - fall back to the deterministic composition below.
    }
  }
  return {
    content: composeFromTemplate(input, profile, template),
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
  const { content, draftedBy } = await composePolicyContent(
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
