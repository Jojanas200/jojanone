import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { platformQuestionSets } from "../db/schema";
import { GDPR_CHECKLIST } from "../../shared/schemas/gdpr-registers";
import {
  TENDER_BID_CHECKLIST,
  TENDER_DIMENSIONS,
} from "../../shared/schemas/tender-readiness";
import {
  INVESTOR_ASSESSMENT_ITEMS,
  INVESTOR_DIMENSIONS,
} from "../../shared/schemas/investor-readiness";
import { COURSES, getCourse } from "../../data/academy-catalog";

// Platform-managed questionnaire overrides. Defaults ship in code; a platform
// admin can override a whole set, and the assessment engines read the merged
// result via getQuestionSet(). Overrides are global (all tenants) and stored
// in a service-role-only table, so this module intentionally uses adminDb.

export type QuestionItem = Record<string, unknown>;

// How the admin editor renders one field of an item.
export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "lines" | "number" | "boolean";
  options?: string[];
  required?: boolean;
  hint?: string;
  /** Stored zero-based but shown to the admin as 1-based (quiz correct answer). */
  oneBased?: boolean;
}

export interface QuestionSetMeta {
  key: string;
  label: string;
  group: string;
  description: string;
  fields: FieldDef[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "item";

const GDPR_FIELDS: FieldDef[] = [
  { key: "label", label: "Question", type: "textarea", required: true },
  { key: "gap", label: "Gap (shown when unmet)", type: "text", required: true },
  {
    key: "recommendation",
    label: "Recommendation",
    type: "text",
    required: true,
  },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["high", "medium"],
    required: true,
  },
];

const BID_FIELDS: FieldDef[] = [
  { key: "label", label: "Question", type: "textarea", required: true },
  {
    key: "dim",
    label: "Dimension",
    type: "select",
    options: [...TENDER_DIMENSIONS],
    required: true,
  },
];

const INVESTOR_FIELDS: FieldDef[] = [
  { key: "text", label: "Question", type: "textarea", required: true },
  {
    key: "dim",
    label: "Dimension",
    type: "select",
    options: [...INVESTOR_DIMENSIONS],
    required: true,
  },
  {
    key: "redFlag",
    label: "Red flag",
    type: "boolean",
    hint: "A No on this question is surfaced to investors as a red flag",
  },
];

const QUIZ_FIELDS: FieldDef[] = [
  { key: "question", label: "Question", type: "textarea", required: true },
  {
    key: "options",
    label: "Options (one per line)",
    type: "lines",
    required: true,
  },
  {
    key: "correct_index",
    label: "Correct option (1-based)",
    type: "number",
    required: true,
    hint: "1 = the first option line",
    oneBased: true,
  },
  { key: "explanation", label: "Explanation (shown when wrong)", type: "text" },
];

/** Every editable set: static checklists + one quiz set per academy course. */
export function listQuestionSets(): QuestionSetMeta[] {
  return [
    {
      key: "gdpr_health_check",
      label: "GDPR health check",
      group: "Assessments",
      description:
        "The yes/no/unsure questions behind the GDPR readiness score, gaps and recommendations.",
      fields: GDPR_FIELDS,
    },
    {
      key: "tender_bid_checklist",
      label: "Tender bid/no-bid checklist",
      group: "Assessments",
      description:
        "The dimension-weighted questions behind the bid/no-bid suitability score.",
      fields: BID_FIELDS,
    },
    {
      key: "investor_assessment",
      label: "Investor readiness assessment",
      group: "Assessments",
      description:
        "The stepped wizard behind the investor readiness score. Questions are grouped into wizard steps by dimension; each dimension is scored separately.",
      fields: INVESTOR_FIELDS,
    },
    ...COURSES.map((c) => ({
      key: `academy_quiz:${c.id}`,
      label: `Quiz - ${c.title}`,
      group: "Academy final quizzes",
      description: `Final quiz for "${c.title}" (80% to pass).`,
      fields: QUIZ_FIELDS,
    })),
  ];
}

function defaultsFor(key: string): QuestionItem[] {
  if (key === "gdpr_health_check") return GDPR_CHECKLIST.map((q) => ({ ...q }));
  if (key === "tender_bid_checklist")
    return TENDER_BID_CHECKLIST.map((q) => ({ ...q }));
  if (key === "investor_assessment")
    return INVESTOR_ASSESSMENT_ITEMS.map((q) => ({ ...q }));
  if (key.startsWith("academy_quiz:")) {
    const course = getCourse(key.slice("academy_quiz:".length));
    return course ? course.quiz.map((q) => ({ ...q })) : [];
  }
  return [];
}

function validatorFor(key: string) {
  if (key === "gdpr_health_check")
    return z
      .array(
        z.object({
          key: z.string().optional(),
          label: z.string().trim().min(1).max(500),
          gap: z.string().trim().min(1).max(300),
          recommendation: z.string().trim().min(1).max(300),
          priority: z.enum(["high", "medium"]),
        }),
      )
      .min(1)
      .max(50);
  if (key === "tender_bid_checklist")
    return z
      .array(
        z.object({
          key: z.string().optional(),
          label: z.string().trim().min(1).max(500),
          dim: z.enum(TENDER_DIMENSIONS),
        }),
      )
      .min(1)
      .max(50);
  if (key === "investor_assessment")
    return z
      .array(
        z.object({
          id: z.string().optional(),
          text: z.string().trim().min(1).max(500),
          dim: z.enum(INVESTOR_DIMENSIONS),
          redFlag: z.boolean().optional().default(false),
        }),
      )
      .min(1)
      .max(60);
  if (key.startsWith("academy_quiz:"))
    return z
      .array(
        z.object({
          id: z.string().optional(),
          question: z.string().trim().min(1).max(1000),
          options: z.array(z.string().trim().min(1).max(300)).min(2).max(8),
          correct_index: z.number().int().min(0),
          explanation: z.string().max(1000).optional(),
        }),
      )
      .min(1)
      .max(60)
      .refine(
        (items) => items.every((q) => q.correct_index < q.options.length),
        { message: "correct_index must point at one of the options" },
      );
  return null;
}

/** Current items for a set: the admin override if present, else the code default. */
export async function getQuestionSet(key: string): Promise<QuestionItem[]> {
  const row = (
    await adminDb
      .select({ questions: platformQuestionSets.questions })
      .from(platformQuestionSets)
      .where(eq(platformQuestionSets.id, key))
      .limit(1)
  )[0];
  const items = row?.questions;
  return items && items.length > 0 ? items : defaultsFor(key);
}

export async function isQuestionSetOverridden(key: string): Promise<boolean> {
  const row = (
    await adminDb
      .select({ id: platformQuestionSets.id })
      .from(platformQuestionSets)
      .where(eq(platformQuestionSets.id, key))
      .limit(1)
  )[0];
  return !!row;
}

/** Validate + store an override. Stable keys/ids are kept; new items get one. */
export async function saveQuestionSet(
  key: string,
  questions: unknown,
  adminEmail: string,
): Promise<{ ok: true; items: QuestionItem[] } | { ok: false; error: string }> {
  const validator = validatorFor(key);
  if (!validator) return { ok: false, error: `Unknown question set: ${key}` };
  const parsed = validator.safeParse(questions);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid questions",
    };

  const seen = new Set<string>();
  const items = parsed.data.map((raw, i) => {
    const item = raw as QuestionItem;
    const idField =
      key === "investor_assessment" || key.startsWith("academy_quiz:")
        ? "id"
        : "key";
    let id = typeof item[idField] === "string" ? (item[idField] as string) : "";
    if (!id)
      id = slug(
        String(item.label ?? item.question ?? item.text ?? `item_${i + 1}`),
      );
    while (seen.has(id)) id = `${id}_${i + 1}`;
    seen.add(id);
    return { ...item, [idField]: id };
  });

  await adminDb
    .insert(platformQuestionSets)
    .values({ id: key, questions: items, updatedByEmail: adminEmail })
    .onConflictDoUpdate({
      target: platformQuestionSets.id,
      set: {
        questions: items,
        updatedByEmail: adminEmail,
        updatedAt: sql`now()`,
      },
    });
  return { ok: true, items };
}

/** Remove the override so the set falls back to the code default. */
export async function resetQuestionSet(key: string): Promise<boolean> {
  const rows = await adminDb
    .delete(platformQuestionSets)
    .where(eq(platformQuestionSets.id, key))
    .returning({ id: platformQuestionSets.id });
  return rows.length > 0;
}
