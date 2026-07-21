import { eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { businessProfiles, onboardingResponses } from "../db/schema";
import {
  isComplete,
  missingInitialFields,
  stripNonPersistable,
  validateAnswers,
} from "../../shared/onboarding/logic";
import { seedModulesFromOnboarding } from "./onboarding-fanout";
import type { OnboardingAnswers } from "../../shared/onboarding/types";

/**
 * Conditional onboarding persistence. All queries run through withUser() (RLS).
 * Answers are a blob keyed by stable field id; secrets are stripped before any
 * write; first-time completion is gated on the schema's initially-required set.
 */

export interface OnboardingState {
  answers: OnboardingAnswers;
  completedAt: Date | null;
  complete: boolean;
}

export function getOnboarding(
  claims: UserClaims,
  workspaceId: string,
): Promise<OnboardingState> {
  return withUser(claims, async (tx) => {
    const row = (
      await tx
        .select()
        .from(onboardingResponses)
        .where(eq(onboardingResponses.workspaceId, workspaceId))
        .limit(1)
    )[0];
    const answers = (row?.answers ?? {}) as OnboardingAnswers;
    return {
      answers,
      completedAt: row?.completedAt ?? null,
      complete: isComplete(answers),
    };
  });
}

/**
 * Merge a patch into the stored answers (save-and-continue). A key set to null
 * clears it. Non-persistable keys (secrets) and unknown keys are dropped by
 * stripNonPersistable before writing — a hostile client can never park a
 * password or card number here.
 */
export function saveOnboarding(
  claims: UserClaims,
  workspaceId: string,
  patch: OnboardingAnswers,
): Promise<OnboardingState> {
  return withUser(claims, async (tx) => {
    const existing = (
      await tx
        .select({ answers: onboardingResponses.answers })
        .from(onboardingResponses)
        .where(eq(onboardingResponses.workspaceId, workspaceId))
        .limit(1)
    )[0];

    const merged: OnboardingAnswers = {
      ...((existing?.answers ?? {}) as OnboardingAnswers),
    };
    for (const [id, value] of Object.entries(patch)) {
      if (value === null || value === undefined) delete merged[id];
      else merged[id] = value;
    }
    const clean = stripNonPersistable(merged);

    const row = (
      await tx
        .insert(onboardingResponses)
        .values({ workspaceId, answers: clean, updatedBy: claims.sub })
        .onConflictDoUpdate({
          target: onboardingResponses.workspaceId,
          set: { answers: clean, updatedBy: claims.sub, updatedAt: sql`now()` },
        })
        .returning()
    )[0];

    return {
      answers: clean,
      completedAt: row.completedAt,
      complete: isComplete(clean),
    };
  });
}

export interface CompleteResult {
  ok: boolean;
  missing: string[];
  issues: { id: string; error: string }[];
  /** Number of starter records seeded across modules (first completion only). */
  seeded: number;
}

/**
 * Finish first-time onboarding: validate the initially-required set, stamp
 * completed_at, mirror the mapped facts into business_profiles, and — on the
 * FIRST completion only — seed starter records across the modules. All atomic.
 * Returns what's still missing when not ready. Idempotent: re-completing is a
 * no-op that never re-seeds.
 */
export function completeOnboarding(
  claims: UserClaims,
  workspaceId: string,
): Promise<CompleteResult> {
  return withUser(claims, async (tx) => {
    const row = (
      await tx
        .select({
          answers: onboardingResponses.answers,
          completedAt: onboardingResponses.completedAt,
        })
        .from(onboardingResponses)
        .where(eq(onboardingResponses.workspaceId, workspaceId))
        .limit(1)
    )[0];
    const answers = (row?.answers ?? {}) as OnboardingAnswers;

    // Already completed → idempotent no-op (never re-seeds).
    if (row?.completedAt)
      return { ok: true, missing: [], issues: [], seeded: 0 };

    const missing = missingInitialFields(answers).map((f) => f.id);
    const issues = validateAnswers(answers);
    if (missing.length || issues.length)
      return { ok: false, missing, issues, seeded: 0 };

    await tx
      .update(onboardingResponses)
      .set({ completedAt: sql`now()`, updatedBy: claims.sub })
      .where(eq(onboardingResponses.workspaceId, workspaceId));

    const profilePatch = buildProfilePatch(answers);
    if (Object.keys(profilePatch).length)
      await tx
        .update(businessProfiles)
        .set({ ...profilePatch, updatedBy: claims.sub })
        .where(eq(businessProfiles.workspaceId, workspaceId));

    const seeded = await seedModulesFromOnboarding(
      tx,
      workspaceId,
      claims.sub,
      answers,
    );

    return { ok: true, missing: [], issues: [], seeded };
  });
}

// --- business_profiles projection --------------------------------------------
type ProfilePatch = Partial<typeof businessProfiles.$inferInsert>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

// "10-24" -> 10, "250+" -> 250, "0" -> 0; anything unparseable -> undefined.
const rangeLow = (v: unknown): number | undefined => {
  if (typeof v !== "string") return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
};

// Only project a boolean when the source answer is actually present, so an
// unanswered question never overwrites a stored value with `false`.
const yesBool = (v: unknown): boolean | undefined =>
  v === undefined ? undefined : v === "yes";
const trueBool = (v: unknown): boolean | undefined =>
  v === undefined ? undefined : v === true;

function buildProfilePatch(a: OnboardingAnswers): ProfilePatch {
  const p: ProfilePatch = {};
  const set = <K extends keyof ProfilePatch>(
    k: K,
    v: ProfilePatch[K] | undefined,
  ) => {
    if (v !== undefined) p[k] = v;
  };

  set("businessName", str(a["company.legal_name"]));
  set("companyNumber", str(a["company.company_number"]));
  set("businessType", str(a["company.business_structure"]));
  set("industry", str(a["company.industry"]));
  set("incorporationDate", str(a["company.incorporation_date"]));
  set("registeredAddress", str(a["company.registered_address"]));
  set("tradingAddress", str(a["company.primary_address"]));
  set("financialYearEnd", str(a["ops.financial_year_end"]));
  set("annualRevenueBand", str(a["ops.revenue_band"]));
  set("employeeCount", rangeLow(a["ops.employee_range"]));
  set("contractorCount", rangeLow(a["ops.contractor_range"]));
  set("vatRegistered", yesBool(a["ops.vat_registered"]));
  set("employerRegistered", trueBool(a["ops.employs_staff"]));
  set("processesPersonalData", yesBool(a["ops.processes_personal_data"]));
  set("tradesInternationally", trueBool(a["ops.trades_internationally"]));

  return p;
}
