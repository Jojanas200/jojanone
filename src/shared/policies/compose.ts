// Deterministic document composition shared by the drafting service (the
// fallback when no AI provider is configured) and the template-library
// preview, so what a user previews is exactly the skeleton the deterministic
// draft produces from their answers and business profile.
//
// Kind-aware: policies keep the original skeleton; contracts, procedures,
// plans, handbooks, letters and records compose against their own sections
// (see sectionsFor / questionsFor in templates.ts). Company facts come only
// from the profile - unknown details get neutral drafting wording, never
// bracketed placeholders or invented facts.
import {
  kindOf,
  questionsFor,
  sectionsFor,
  type PolicyDocumentKind,
  type PolicyTemplate,
} from "./templates";

export interface ComposeProfile {
  businessName?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  primaryContactName?: string | null;
}

export interface ComposeDraftInput {
  policyName: string;
  templateKey?: string | null;
  answers?: Record<string, string | undefined>;
}

interface ComposeCtx {
  name: string;
  sector: string | undefined;
  staff: number;
  contact: string | undefined;
  topic: string;
  template: PolicyTemplate | null;
}

// Neutral fallbacks for REQUIRED sections left unanswered, per document kind.
// Optional sections with no answer are simply omitted.
function defaultsForKind(
  kind: PolicyDocumentKind,
  c: ComposeCtx,
): Record<string, string> {
  const owner = c.contact || "the business owner";
  const reviewMonths = c.template?.reviewMonths ?? 12;
  switch (kind) {
    case "policy":
      return {
        purpose:
          c.template?.defaultPurpose ??
          `To establish a clear and consistent approach to ${c.topic} across ${c.name}.`,
        scope:
          c.staff > 0
            ? `This policy applies to all ${c.staff} employees of ${c.name}, together with contractors, temporary staff and volunteers acting on its behalf.`
            : `This policy applies to all staff, contractors, temporary workers and volunteers acting on behalf of ${c.name}.`,
        roles: `${
          c.contact ? `${c.contact}, as business owner,` : "The business owner"
        } is accountable for this policy. Managers apply it day to day; all staff are expected to read, understand and follow it, and to raise concerns promptly.`,
        policy_statements: `${c.name} will maintain proportionate, practical arrangements for ${c.topic}, acting fairly and lawfully and keeping appropriate records.`,
        procedures:
          "We will make this policy available to everyone in scope and explain it at induction, keep the records needed to show it is being followed, and act on issues raised without unreasonable delay.",
        reporting: `Questions, concerns or suspected breaches should be raised with ${owner}, who will respond promptly and keep the person informed.`,
        records:
          "We will keep the records needed to demonstrate this policy is being followed, for as long as required and no longer.",
        professional_support:
          "Where a matter is complex or high-risk, we will seek appropriate professional advice before acting.",
        review_schedule: `This policy will be reviewed at least every ${reviewMonths} months, or sooner if the law, our operations or our risks change.`,
      };
    case "contract":
      return {
        parties: `This agreement is made between ${c.name} and the counterparty identified in the signature block below.`,
        services:
          "The services or goods to be provided are as described in the schedule agreed in writing between the parties.",
        fees: "Fees and payment terms are as set out in the agreed schedule or order form, with invoices payable within 30 days unless otherwise agreed in writing.",
        term: "This agreement starts on the date of the last signature and continues until ended in accordance with its terms.",
        termination:
          "Either party may terminate in accordance with the notice provisions of this agreement. Termination does not affect rights already accrued.",
        signatures:
          "Signed by the authorised representatives of each party, with name, role and date.",
      };
    case "procedure":
      return {
        purpose:
          c.template?.defaultPurpose ??
          `To set out how ${c.name} handles ${c.topic}.`,
        trigger:
          "This procedure applies whenever the situation it covers arises. Start at the first step without delay.",
        roles: `${owner} is responsible for this procedure and for making sure everyone involved knows their part.`,
        steps:
          "Follow the steps below in order, recording what was done, by whom and when.",
        records:
          "Keep a record of each time this procedure is used, including dates, actions taken and outcomes.",
        review_schedule: `This procedure is reviewed at least every ${reviewMonths} months and after each significant use.`,
      };
    case "plan":
      return {
        purpose:
          c.template?.defaultPurpose ??
          `To prepare ${c.name} to respond to ${c.topic}.`,
        scenarios:
          "This plan covers significant disruption to normal operations; treat comparable events the same way.",
        activation: `The plan is activated by ${owner} as soon as a qualifying incident is identified.`,
        roles: `${owner} leads the response and assigns roles as the situation requires.`,
        response:
          "Make people safe, assess the situation, contain the impact and begin recovery, recording decisions and times as you go.",
        testing:
          "This plan is tested at least annually and reviewed after every activation.",
      };
    case "handbook":
      return {
        welcome:
          c.template?.defaultPurpose ??
          `A single reference for how things work at ${c.name}.`,
        working:
          "Standard working arrangements are as agreed in each person's contract and summarised here.",
        conduct:
          "Everyone is expected to act honestly, safely and respectfully, and to raise concerns early.",
        acknowledgement:
          "Each team member confirms they have read and understood this handbook.",
      };
    case "notice":
      return {
        purpose: c.template?.defaultPurpose ?? `Regarding ${c.topic}.`,
        details: "",
        contact: `Please contact ${owner} at ${c.name} with any questions about this document.`,
      };
    case "statement":
      return {
        background:
          c.template?.defaultPurpose ?? `This record is made by ${c.name}.`,
        details: "",
        approval: `Approved by ${owner} on behalf of ${c.name}.`,
      };
  }
}

function introFor(kind: PolicyDocumentKind, c: ComposeCtx): string {
  const withSector = `${c.name}${c.sector ? `, a ${c.sector} business,` : ""}`;
  switch (kind) {
    case "policy":
      return `${withSector} is committed to operating responsibly and in line with applicable UK law. This policy sets out our approach to ${c.topic}.`;
    case "contract":
      return `${withSector} enters into this agreement on the terms set out below.`;
    case "procedure":
      return `This procedure sets out how ${c.name} handles ${c.topic}.`;
    case "plan":
      return `This plan sets out how ${c.name} prepares for and responds to ${c.topic}.`;
    case "handbook":
      return `This handbook brings together the key information, expectations and support for everyone working at ${c.name}.`;
    case "notice":
      return `Prepared by ${c.name}.`;
    case "statement":
      return `This formal record is made by ${c.name}.`;
  }
}

// One section per skeleton heading for the document's kind, filled from the
// guided answers that target it, with a neutral default otherwise.
export function composeFromTemplate(
  input: ComposeDraftInput,
  profile: ComposeProfile | null,
  template: PolicyTemplate | null,
): string {
  const kind = template?.kind ?? kindOf(input.templateKey);
  const sections = sectionsFor(template?.key ?? input.templateKey);
  const questions = questionsFor(template?.key ?? input.templateKey);

  const ctx: ComposeCtx = {
    name: profile?.businessName?.trim() || "the business",
    sector: profile?.industry?.trim() || undefined,
    staff: profile?.employeeCount ?? 0,
    contact: profile?.primaryContactName?.trim() || undefined,
    topic: input.policyName.trim().toLowerCase(),
    template,
  };

  // Group answers by the section they target. Defensive: direct service
  // callers may omit answers entirely (the API route's zod default fills {}).
  const answers = input.answers ?? {};
  const byTarget: Record<string, string[]> = {};
  for (const qn of questions) {
    const a = answers[qn.key]?.trim();
    if (a) (byTarget[qn.sectionTarget] ??= []).push(a);
  }

  const defaults = defaultsForKind(kind, ctx);
  const out: string[] = [input.policyName.trim(), "", introFor(kind, ctx)];

  let n = 0;
  for (const s of sections) {
    const sectionAnswers = byTarget[s.key] ?? [];
    let body = sectionAnswers.join("\n\n");
    if (!body) {
      if (s.optional) continue; // skip optional sections with no input
      body = defaults[s.key] ?? "";
    }
    if (!body) continue;
    n += 1;
    out.push("", `${n}. ${s.heading}`, body);
  }

  out.push(
    "",
    "This is a starting draft prepared by Jova from your answers and business profile. Review and adapt it to your circumstances, and seek advice from a qualified professional before adopting it.",
  );
  return out.join("\n");
}
