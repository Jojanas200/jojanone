// =============================================================================
// Conditional onboarding schema - logic helpers.
// Pure functions over the schema + a set of answers. No I/O. Shared by the
// server (gate + persistence) and the client (wizard rendering).
// =============================================================================
import { ONBOARDING_SCHEMA } from "./schema";
import type { FieldDef, JsonValue, OnboardingAnswers, Rule } from "./types";

export const SECTIONS = ONBOARDING_SCHEMA;

export const ALL_FIELDS: FieldDef[] = ONBOARDING_SCHEMA.flatMap(
  (s) => s.fields,
);

const FIELD_BY_ID = new Map<string, FieldDef>();
for (const f of ALL_FIELDS) {
  if (FIELD_BY_ID.has(f.id))
    throw new Error(`Duplicate onboarding field id: ${f.id}`);
  FIELD_BY_ID.set(f.id, f);
}

export function getField(id: string): FieldDef | undefined {
  return FIELD_BY_ID.get(id);
}

// --- Rule evaluation ---------------------------------------------------------
export function evaluateRule(rule: Rule, answers: OnboardingAnswers): boolean {
  if ("all" in rule) return rule.all.every((r) => evaluateRule(r, answers));
  if ("any" in rule) return rule.any.some((r) => evaluateRule(r, answers));
  if ("not" in rule) return !evaluateRule(rule.not, answers);

  const value = answers[rule.field];
  if ("equals" in rule) return value === rule.equals;
  if ("in" in rule) return rule.in.some((v) => v === value);
  if ("contains" in rule)
    return Array.isArray(value) && value.some((v) => v === rule.contains);
  if ("truthy" in rule) return value === true || value === "yes";
  return false;
}

/** A field is shown when it has no rule, or its showIf rule matches. */
export function isVisible(
  field: FieldDef,
  answers: OnboardingAnswers,
): boolean {
  return field.showIf ? evaluateRule(field.showIf, answers) : true;
}

/** Every field currently visible given the answers so far. */
export function visibleFields(answers: OnboardingAnswers): FieldDef[] {
  return ALL_FIELDS.filter((f) => isVisible(f, answers));
}

// --- "Answered" test (type-aware) --------------------------------------------
export function isAnswered(
  field: FieldDef,
  value: JsonValue | undefined,
): boolean {
  if (value === undefined || value === null) return false;
  switch (field.type) {
    case "consent":
      return value === true; // must be affirmatively ticked
    case "boolean":
      return value === true || value === false;
    case "yesno_unsure":
      return value === "yes" || value === "no" || value === "unsure";
    case "multiselect":
    case "people_list":
    case "team_invites":
      return Array.isArray(value) && value.length > 0;
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    default:
      return typeof value === "string" ? value.trim().length > 0 : true;
  }
}

/**
 * Whether a (visible) field must be answered to finish first-time onboarding:
 * base required === "initial", or a requiredIf rule currently matches. Hidden
 * fields are never required.
 */
export function isRequiredNow(
  field: FieldDef,
  answers: OnboardingAnswers,
): boolean {
  if (!isVisible(field, answers)) return false;
  if (field.required === "initial") return true;
  if (field.requiredIf) return evaluateRule(field.requiredIf, answers);
  return false;
}

/**
 * Visible, initially-required fields that are not yet validly answered.
 * neverStore fields (password, card details) are satisfied outside the answer
 * blob (auth / payment provider), so they never gate answer-based completion.
 */
export function missingInitialFields(answers: OnboardingAnswers): FieldDef[] {
  return ALL_FIELDS.filter(
    (f) =>
      !f.neverStore &&
      isRequiredNow(f, answers) &&
      !isAnswered(f, answers[f.id]),
  );
}

// --- Per-value validation ----------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or null when the value is acceptable. */
export function validateValue(
  field: FieldDef,
  value: JsonValue | undefined,
): string | null {
  if (value === undefined || value === null) return null; // emptiness handled by the gate
  const v = field.validation ?? {};

  if (
    field.type === "text" ||
    field.type === "textarea" ||
    field.type === "address" ||
    field.type === "email" ||
    field.type === "tel" ||
    field.type === "url"
  ) {
    if (typeof value !== "string") return "Expected text.";
    if (v.minLength && value.trim().length < v.minLength)
      return `Must be at least ${v.minLength} characters.`;
    if (v.maxLength && value.length > v.maxLength)
      return `Must be ${v.maxLength} characters or fewer.`;
    if ((v.email || field.type === "email") && value && !EMAIL_RE.test(value))
      return "Enter a valid email address.";
    if (v.pattern && value && !new RegExp(v.pattern).test(value))
      return "Invalid format.";
  }

  if (field.type === "number") {
    if (typeof value !== "number") return "Expected a number.";
    if (v.min !== undefined && value < v.min)
      return `Must be at least ${v.min}.`;
    if (v.max !== undefined && value > v.max)
      return `Must be at most ${v.max}.`;
  }

  if (field.type === "select" && field.options) {
    if (!field.options.some((o) => o.value === value))
      return "Choose one of the options.";
  }

  if (field.type === "multiselect") {
    if (!Array.isArray(value)) return "Expected a list.";
    if (v.minLength && value.length < v.minLength)
      return `Select at least ${v.minLength}.`;
    if (
      field.options &&
      !value.every((x) => field.options!.some((o) => o.value === x))
    )
      return "Contains an invalid option.";
  }

  return null;
}

/** All validation issues across the answered fields. */
export function validateAnswers(
  answers: OnboardingAnswers,
): { id: string; error: string }[] {
  const issues: { id: string; error: string }[] = [];
  for (const f of ALL_FIELDS) {
    if (!isVisible(f, answers)) continue;
    const err = validateValue(f, answers[f.id]);
    if (err) issues.push({ id: f.id, error: err });
  }
  return issues;
}

// --- Persistence safety ------------------------------------------------------
/** Field ids that Jojan One must never persist (auth password, card details). */
export const NEVER_STORE_IDS = new Set(
  ALL_FIELDS.filter((f) => f.neverStore || f.type === "password").map(
    (f) => f.id,
  ),
);

/**
 * Drop any key we must not store (secrets) and any key not in the schema.
 * The server calls this before writing, so a hostile client can never park a
 * password / card number in our database or smuggle in unknown keys.
 */
export function stripNonPersistable(
  answers: OnboardingAnswers,
): OnboardingAnswers {
  const clean: OnboardingAnswers = {};
  for (const [id, value] of Object.entries(answers)) {
    if (NEVER_STORE_IDS.has(id)) continue;
    if (!FIELD_BY_ID.has(id)) continue;
    if (value === undefined) continue;
    clean[id] = value;
  }
  return clean;
}

// --- Downstream routing ------------------------------------------------------
/** Persistable fields grouped by the module their answer feeds. */
export function fieldsByModule(): Record<string, FieldDef[]> {
  const out: Record<string, FieldDef[]> = {};
  for (const f of ALL_FIELDS) {
    if (NEVER_STORE_IDS.has(f.id)) continue;
    (out[f.destinationModule] ??= []).push(f);
  }
  return out;
}

/** Fields answered "unsure" - each becomes a review recommendation, not a block. */
export function reviewRecommendations(answers: OnboardingAnswers): FieldDef[] {
  return ALL_FIELDS.filter(
    (f) => isVisible(f, answers) && answers[f.id] === "unsure",
  );
}

/** True when every initially-required field is validly answered. */
export function isComplete(answers: OnboardingAnswers): boolean {
  return (
    missingInitialFields(answers).length === 0 &&
    validateAnswers(answers).length === 0
  );
}
