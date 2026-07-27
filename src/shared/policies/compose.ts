// Deterministic document composition shared by the drafting service (the
// fallback when no AI provider is configured) and the template-library
// preview, so what a user previews is exactly the skeleton the deterministic
// draft produces from their answers and business profile.
import {
  POLICY_SECTIONS,
  questionsFor,
  sectionHeading,
  type PolicyTemplate,
} from "./templates";

export interface ComposeProfile {
  businessName?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
}

export interface ComposeDraftInput {
  policyName: string;
  templateKey?: string | null;
  answers?: Record<string, string | undefined>;
}

// One section per skeleton heading, filled from the guided answers that
// target it, with a sensible default otherwise.
export function composeFromTemplate(
  input: ComposeDraftInput,
  profile: ComposeProfile | null,
  template: PolicyTemplate | null,
): string {
  const name = profile?.businessName?.trim() || "the business";
  const sector = profile?.industry?.trim();
  const staff = profile?.employeeCount ?? 0;
  const topic = input.policyName.trim().toLowerCase();
  const questions = questionsFor(input.templateKey);

  // Group answers by the section they target. Defensive: direct service
  // callers may omit answers entirely (the API route's zod default fills {}).
  const answers = input.answers ?? {};
  const byTarget: Record<string, string[]> = {};
  for (const q of questions) {
    const a = answers[q.key]?.trim();
    if (a) (byTarget[q.sectionTarget] ??= []).push(a);
  }

  const defaults: Record<string, string> = {
    purpose:
      template?.defaultPurpose ??
      `To establish a clear and consistent approach to ${topic} across ${name}.`,
    scope:
      staff > 0
        ? `This policy applies to all ${staff} employees of ${name}, together with contractors, temporary staff and volunteers acting on its behalf.`
        : `This policy applies to all staff, contractors, temporary workers and volunteers acting on behalf of ${name}.`,
    roles:
      "The business owner ([Business owner]) is accountable for this policy. Managers apply it day to day; all staff are expected to read, understand and follow it, and to raise concerns promptly.",
    policy_statements: `${name} will maintain proportionate, practical arrangements for ${topic}, acting fairly and lawfully and keeping appropriate records.`,
    procedures:
      "We will make this policy available to everyone in scope and explain it at induction, keep the records needed to show it is being followed, and act on issues raised without unreasonable delay.",
    reporting:
      "Questions, concerns or suspected breaches should be raised with [Business owner], who will respond promptly and keep the person informed.",
    records:
      "We will keep the records needed to demonstrate this policy is being followed, for as long as required and no longer.",
    professional_support:
      "Where a matter is complex or high-risk, we will seek appropriate professional advice before acting.",
    review_schedule: `This policy will be reviewed at least every ${template?.reviewMonths ?? 12} months, or sooner if the law, our operations or our risks change.`,
  };

  const out: string[] = [
    input.policyName.trim(),
    "",
    `${name}${sector ? `, a ${sector} business,` : ""} is committed to operating responsibly and in line with applicable UK law. This policy sets out our approach to ${topic}.`,
  ];

  let n = 0;
  for (const s of POLICY_SECTIONS) {
    const sectionAnswers = byTarget[s.key] ?? [];
    let body = sectionAnswers.join("\n\n");
    if (!body) {
      if (s.optional) continue; // skip optional sections with no input
      body = defaults[s.key] ?? "";
    }
    if (!body) continue;
    n += 1;
    out.push("", `${n}. ${sectionHeading(s.key)}`, body);
  }

  out.push(
    "",
    "This is a starting draft prepared by Jova from your answers and business profile. Review and adapt it to your circumstances, and seek advice from a qualified professional before adopting it.",
  );
  return out.join("\n");
}
