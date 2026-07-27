// The Jova Policy Check: one universal validation engine for every document in
// the library, plus a per-type schema of extra requirements. Deterministic and
// framework-free so the server (adoption gating), the API and the UI all run
// the exact same checks. Statuses: "pass" (requirement satisfied), "warning"
// (user can continue but should review) and "critical" (must be resolved
// before adoption).

import { getPolicyTemplate } from "./templates";

export type CheckStatus = "pass" | "warning" | "critical";

export interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface PolicyCheckResult {
  items: CheckItem[];
  criticals: number;
  warnings: number;
  /** true when there are no critical issues - the draft is ready for adoption. */
  readyForAdoption: boolean;
}

export interface PolicyCheckMeta {
  owner?: string | null;
  reviewDate?: string | null;
  version?: string | null;
  templateKey?: string | null;
  category?: string | null;
}

// Lines Jova appends to drafts that must never survive into adopted wording.
export const DRAFT_DISCLAIMER_MARKER = "starting draft";
const ADVICE_PATTERNS = [
  /jova (recommends|suggests|believes|check)/i,
  /^jova[ :]/im,
  /should assess whether it is (legally )?required/i,
  /we do not have enough information/i,
];

// A required section is satisfied when its heading OR one of its synonyms
// appears in the document.
const UNIVERSAL_SECTIONS: { key: string; label: string; needles: string[] }[] =
  [
    { key: "purpose", label: "Purpose stated", needles: ["purpose"] },
    { key: "scope", label: "Scope defined", needles: ["scope", "applies to"] },
    {
      key: "roles",
      label: "Responsibilities identified",
      needles: ["responsibilit", "accountable", "roles"],
    },
    {
      key: "reporting",
      label: "Reporting and escalation route included",
      needles: ["report", "escalat", "raise", "concern"],
    },
    {
      key: "records",
      label: "Record-keeping requirements addressed",
      needles: ["record"],
    },
    {
      key: "review",
      label: "Review frequency established",
      needles: ["review"],
    },
  ];

// Per-type requirements attached by template key (specific wins) or category.
// One engine, many schemas - extend here rather than coding per-policy logic.
interface TypeCheck {
  key: string;
  label: string;
  needles: string[];
}
const TYPE_CHECKS_BY_TEMPLATE: Record<string, TypeCheck[]> = {
  tpl_data_protection: [
    {
      key: "lawful_basis",
      label: "Lawful bases covered",
      needles: ["lawful bas", "legitimate interest", "consent"],
    },
    {
      key: "rights",
      label: "Data subject rights covered",
      needles: ["rights", "subject access"],
    },
    { key: "breach", label: "Breach management covered", needles: ["breach"] },
    {
      key: "retention",
      label: "Retention addressed",
      needles: ["retention", "retain"],
    },
    {
      key: "processors",
      label: "Processors / sharing addressed",
      needles: ["processor", "third part", "shar"],
    },
  ],
  tpl_privacy_notice: [
    {
      key: "rights",
      label: "Individual rights explained",
      needles: ["rights"],
    },
    {
      key: "lawful_basis",
      label: "Lawful bases explained",
      needles: ["lawful bas", "legitimate interest", "consent"],
    },
    {
      key: "retention",
      label: "Retention explained",
      needles: ["retention", "retain", "keep"],
    },
  ],
  tpl_health_safety: [
    {
      key: "risk_assessment",
      label: "Risk assessments covered",
      needles: ["risk assessment"],
    },
    {
      key: "incidents",
      label: "Accidents / incidents covered",
      needles: ["accident", "incident"],
    },
    {
      key: "emergency",
      label: "Emergency arrangements covered",
      needles: ["emergency", "fire", "evacuat"],
    },
    {
      key: "training",
      label: "Safety training covered",
      needles: ["training"],
    },
  ],
  tpl_equal_opps: [
    {
      key: "characteristics",
      label: "Protected characteristics referenced",
      needles: ["protected characteristic", "discriminat"],
    },
    {
      key: "complaints",
      label: "Complaints route included",
      needles: ["complain", "grievance", "report"],
    },
  ],
  tpl_anti_bribery: [
    {
      key: "gifts",
      label: "Gifts and hospitality covered",
      needles: ["gift", "hospitality"],
    },
    {
      key: "third_parties",
      label: "Third parties / intermediaries covered",
      needles: ["third part", "agent", "intermediar"],
    },
    {
      key: "reporting",
      label: "Reporting concerns covered",
      needles: ["report", "speak up", "whistle"],
    },
  ],
  tpl_ai_use: [
    {
      key: "permitted",
      label: "Permitted / prohibited use defined",
      needles: ["permitted", "prohibited", "approved"],
    },
    {
      key: "confidential",
      label: "Confidential data protections stated",
      needles: ["confidential", "sensitive", "personal data"],
    },
    {
      key: "oversight",
      label: "Human oversight required",
      needles: ["human", "oversight", "review"],
    },
  ],
  tpl_whistleblowing: [
    {
      key: "confidential",
      label: "Confidential reporting route",
      needles: ["confiden", "anonym"],
    },
    {
      key: "protection",
      label: "Protection from reprisal stated",
      needles: ["reprisal", "detriment", "victimis"],
    },
  ],
  tpl_breach_response: [
    {
      key: "ico",
      label: "ICO notification assessment covered",
      needles: ["ico", "72 hour", "commissioner"],
    },
    {
      key: "containment",
      label: "Containment steps covered",
      needles: ["contain"],
    },
  ],
};
const TYPE_CHECKS_BY_CATEGORY: Record<string, TypeCheck[]> = {
  "Health & Safety": [
    {
      key: "incidents",
      label: "Incident reporting covered",
      needles: ["accident", "incident", "report"],
    },
    {
      key: "responsibilities",
      label: "Safety responsibilities assigned",
      needles: ["responsibilit"],
    },
  ],
  "Data protection": [
    {
      key: "personal_data",
      label: "Personal data handling addressed",
      needles: ["personal data"],
    },
  ],
  Governance: [
    {
      key: "decisions",
      label: "Decision / disclosure route included",
      needles: ["declar", "disclos", "decision", "report"],
    },
  ],
};

/** Bracketed tokens like [Business owner], [Name], [Date] left in the text. */
export function findPlaceholders(content: string): string[] {
  const found = new Set<string>();
  for (const m of content.matchAll(/\[[A-Za-z][^\]\n]{0,40}\]/g))
    found.add(m[0]);
  return [...found];
}

export function runPolicyCheck(
  content: string,
  meta: PolicyCheckMeta = {},
): PolicyCheckResult {
  const items: CheckItem[] = [];
  const hay = content.toLowerCase();
  const has = (needles: string[]) => needles.some((n) => hay.includes(n));

  // 1. Unresolved placeholders - never adoptable with these in the text.
  const placeholders = findPlaceholders(content);
  items.push(
    placeholders.length === 0
      ? {
          key: "placeholders",
          label: "No unresolved placeholders",
          status: "pass",
        }
      : {
          key: "placeholders",
          label: "Unresolved placeholders in the document",
          status: "critical",
          detail: `Found ${placeholders.join(", ")}. Replace each with the real detail or neutral role wording.`,
        },
  );

  // 2. Responsible person: a named owner on the record, or role wording in the
  // document body.
  const ownerNamed = !!meta.owner?.trim();
  const roleWorded = has([
    "business owner",
    "designated",
    "responsible for this policy",
    "accountable",
  ]);
  items.push(
    ownerNamed
      ? { key: "owner", label: "Responsible person confirmed", status: "pass" }
      : roleWorded
        ? {
            key: "owner",
            label: "Responsible person needs confirmation",
            status: "warning",
            detail:
              "The document uses role wording but no named owner is set on the policy record. Set the owner in Properties.",
          }
        : {
            key: "owner",
            label: "No responsible person or role identified",
            status: "critical",
            detail:
              "Name a policy owner in Properties or add responsibility wording to the document.",
          },
  );

  // 3. Universal required sections.
  for (const s of UNIVERSAL_SECTIONS) {
    const critical = s.key === "purpose" || s.key === "scope";
    items.push(
      has(s.needles)
        ? { key: s.key, label: s.label, status: "pass" }
        : {
            key: s.key,
            label: `${s.label.replace(/ (stated|defined|identified|included|addressed|established)$/, "")} missing`,
            status: critical ? "critical" : "warning",
            detail: `The document does not appear to cover this. Add a section on ${s.needles[0]}.`,
          },
    );
  }

  // 4. Review schedule on the record itself.
  items.push(
    meta.reviewDate
      ? { key: "review_date", label: "Next review date set", status: "pass" }
      : {
          key: "review_date",
          label: "No next review date on the record",
          status: "warning",
          detail: "Set a review date so the policy enters the review schedule.",
        },
  );

  // 5. Jova advice must not sit inside policy wording.
  const advice = ADVICE_PATTERNS.some((p) => p.test(content));
  items.push(
    advice
      ? {
          key: "advice",
          label: "Jova advice found inside the policy wording",
          status: "critical",
          detail:
            "Recommendations belong in the Jova Recommendations panel, not the adopted document. Edit the document to remove advisory sentences.",
        }
      : {
          key: "advice",
          label: "No Jova advice inside the policy",
          status: "pass",
        },
  );

  // 6. Type-specific requirements (template key first, category fallback).
  const template = getPolicyTemplate(meta.templateKey);
  const typeChecks =
    (meta.templateKey
      ? TYPE_CHECKS_BY_TEMPLATE[meta.templateKey]
      : undefined) ??
    (template ? TYPE_CHECKS_BY_TEMPLATE[template.key] : undefined) ??
    TYPE_CHECKS_BY_CATEGORY[meta.category ?? template?.category ?? ""] ??
    [];
  for (const c of typeChecks) {
    items.push(
      has(c.needles)
        ? { key: `type_${c.key}`, label: c.label, status: "pass" }
        : {
            key: `type_${c.key}`,
            label: `${c.label} - not found`,
            status: "warning",
            detail:
              "Expected for this policy type. Review the document and add it if it applies.",
          },
    );
  }

  const criticals = items.filter((i) => i.status === "critical").length;
  const warnings = items.filter((i) => i.status === "warning").length;
  return { items, criticals, warnings, readyForAdoption: criticals === 0 };
}

/**
 * Final wording for an adopted document: strips the draft disclaimer line and
 * any stray Jova-advice lines. Placeholder removal is NOT done here - the
 * check blocks adoption while placeholders remain, so the user resolves them.
 */
export function finalisedContent(content: string): string {
  return content
    .split("\n")
    .filter((line) => {
      const l = line.toLowerCase();
      if (l.includes(DRAFT_DISCLAIMER_MARKER)) return false;
      if (/^jova[ :]/i.test(line.trim())) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
