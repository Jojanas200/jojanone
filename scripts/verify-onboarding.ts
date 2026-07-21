/**
 * End-to-end verification of conditional onboarding against the REAL Supabase
 * project: save-and-continue merge → secret/unknown stripping → conditional
 * (requiredIf) gate → completion + business_profiles sync → RLS isolation →
 * cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-onboarding.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  complianceObligations,
  organisations,
  policies,
  processingActivities,
  risks,
  workspaces,
} from "../src/server/db/schema";
import {
  completeOnboarding,
  getOnboarding,
  saveOnboarding,
} from "../src/server/services/onboarding";
import { getBusinessProfile } from "../src/server/services/settings";
import { provisionWorkspace } from "../src/server/services/provisioning";
import type { OnboardingAnswers } from "../src/shared/onboarding/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
async function createUser(email: string): Promise<string> {
  const res = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Test-Passw0rd!",
      email_confirm: true,
    }),
  });
  if (!res.ok) throw new Error(`createUser: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; user?: { id: string } };
  const id = data.id ?? data.user?.id;
  if (!id) throw new Error("createUser: no id");
  return id;
}
const deleteUser = (id: string) =>
  adminFetch(`/users/${id}`, { method: "DELETE" });

// The initially-required set (minus company_number, added conditionally).
const INITIAL: OnboardingAnswers = {
  "owner.full_name": "Alex Owner",
  "owner.work_email": "alex@example.test",
  "owner.authorised": true,
  "owner.accept_terms": true,
  "company.legal_name": "Verify Onboarding Ltd",
  "company.business_structure": "limited_company",
  "company.registered_country": "united_kingdom",
  "company.industry": "technology",
  "ops.employee_range": "10-24",
  "ops.contractor_range": "1-4",
  "ops.has_website": true,
  "ops.processes_personal_data": "yes",
  "ops.employs_staff": true,
  "ops.uses_contractors": false,
  "growth.priorities": ["compliance", "gdpr"],
  "jova.understands_not_advice": true,
  // Extra (optional) answers that drive the module fan-out seeds:
  "compliance.health_safety": "yes",
  "ops.regulated_activities": "unsure",
  "risk.ins_employers_liability": "no",
  "risk.continuity_plans": "no",
  "gdpr.has_privacy_notice": "no",
  "gdpr.data_subjects": ["employees", "customers"],
  "gdpr.purposes": ["service_delivery", "employment"],
  "gdpr.special_category": "no",
  "gdpr.transfers_outside_uk": "yes",
};

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vonb-a-${stamp}@example.test`);
    userB = await createUser(`vonb-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VOnb A", workspaceName: "VOnb A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VOnb B", workspaceName: "VOnb B" },
    );
    const A = { sub: userA };
    const B = { sub: userB };

    // --- save-and-continue merge -------------------------------------------
    await saveOnboarding(A, wsA, { "owner.full_name": "Alex Owner" });
    await saveOnboarding(A, wsA, {
      "company.legal_name": "Verify Onboarding Ltd",
    });
    let state = await getOnboarding(A, wsA);
    check(
      "save-and-continue merges across calls",
      state.answers["owner.full_name"] === "Alex Owner" &&
        state.answers["company.legal_name"] === "Verify Onboarding Ltd",
    );

    // null clears a field
    await saveOnboarding(A, wsA, { "owner.full_name": null });
    state = await getOnboarding(A, wsA);
    check(
      "null patch clears a stored field",
      !("owner.full_name" in state.answers),
    );

    // --- secret + unknown stripping ----------------------------------------
    await saveOnboarding(A, wsA, {
      "owner.password": "hunter2",
      "billing.card_details": "4242424242424242",
      "not.a.real.field": "junk",
      "company.industry": "technology",
    });
    state = await getOnboarding(A, wsA);
    check("password is never stored", !("owner.password" in state.answers));
    check(
      "card details are never stored",
      !("billing.card_details" in state.answers),
    );
    check("unknown keys are dropped", !("not.a.real.field" in state.answers));
    check(
      "valid known field is kept",
      state.answers["company.industry"] === "technology",
    );

    // --- conditional (requiredIf) gate -------------------------------------
    // Everything except company_number, with a limited_company structure.
    const partial = await saveOnboarding(A, wsA, INITIAL);
    check(
      "save reports complete=false while a required field is missing",
      partial.complete === false,
    );
    let res = await completeOnboarding(A, wsA);
    check(
      "limited company: company_number blocks completion (requiredIf)",
      res.ok === false && res.missing.includes("company.company_number"),
    );

    // Switching to sole trader removes that requirement — the save now reports
    // complete=true, exactly the signal a module-card uses to offer "Finish
    // setup" once the last required field is filled.
    const nowComplete = await saveOnboarding(A, wsA, {
      "company.business_structure": "sole_trader",
    });
    check(
      "save flips complete=true once the last required field is filled",
      nowComplete.complete === true,
    );
    res = await completeOnboarding(A, wsA);
    check(
      "sole trader: company_number not required → completes",
      res.ok === true,
    );

    state = await getOnboarding(A, wsA);
    check("completion stamps completed_at", state.completedAt !== null);
    check("completion sets complete flag", state.complete === true);

    // --- business_profiles projection --------------------------------------
    const profile = await getBusinessProfile(A, wsA);
    check(
      "sync mirrors legal name + industry into business profile",
      profile?.businessName === "Verify Onboarding Ltd" &&
        profile?.industry === "technology",
    );
    check(
      "sync mirrors booleans (employs staff, processes personal data)",
      profile?.employerRegistered === true &&
        profile?.processesPersonalData === true,
    );
    check(
      "sync maps employee range to a representative count",
      profile?.employeeCount === 10,
    );

    // --- module fan-out (first completion only) ----------------------------
    const obligations = await adminDb
      .select({ title: complianceObligations.title })
      .from(complianceObligations)
      .where(eq(complianceObligations.workspaceId, wsA));
    const riskRows = await adminDb
      .select({ title: risks.riskTitle })
      .from(risks)
      .where(eq(risks.workspaceId, wsA));
    const policyRows = await adminDb
      .select({ name: policies.policyName })
      .from(policies)
      .where(eq(policies.workspaceId, wsA));

    check(
      "fan-out seeded starter records across modules",
      obligations.length > 0 && riskRows.length > 0 && policyRows.length > 0,
    );
    check(
      "compliance: PAYE payroll obligation seeded",
      obligations.some((o) => o.title.includes("PAYE payroll")),
    );
    check(
      "compliance: unsure answer becomes a review obligation",
      obligations.some((o) =>
        o.title.includes("Review whether regulated activities"),
      ),
    );
    check(
      "risk: employers’ liability gap seeded",
      riskRows.some((r) => r.title.toLowerCase().includes("employers")),
    );
    check(
      "risk: continuity-plan gap seeded",
      riskRows.some((r) => r.title.includes("continuity")),
    );
    check(
      "policies: Data Protection Policy stub seeded",
      policyRows.some((p) => p.name === "Data Protection Policy"),
    );
    check(
      "policies: Health & Safety Policy stub seeded",
      policyRows.some((p) => p.name === "Health & Safety Policy"),
    );

    const ropaRows = await adminDb
      .select({
        name: processingActivities.activityName,
        purpose: processingActivities.businessPurpose,
        intl: processingActivities.internationalTransfers,
      })
      .from(processingActivities)
      .where(eq(processingActivities.workspaceId, wsA));
    check(
      "gdpr: starter ROPA entry seeded with mapped labels",
      ropaRows.length === 1 &&
        ropaRows[0].name === "General business processing" &&
        !!ropaRows[0].purpose?.includes("Delivering products") &&
        ropaRows[0].intl === true,
    );

    const policyCountBefore = policyRows.length;
    const again = await completeOnboarding(A, wsA);
    check(
      "re-completing is an idempotent no-op (seeds nothing)",
      again.ok === true && again.seeded === 0,
    );
    const policyRows2 = await adminDb
      .select({ id: policies.id })
      .from(policies)
      .where(eq(policies.workspaceId, wsA));
    check(
      "re-completing does not duplicate seeds",
      policyRows2.length === policyCountBefore,
    );

    // --- missing-required reporting ----------------------------------------
    await saveOnboarding(B, wsB, { "owner.full_name": "Bea Owner" });
    const bRes = await completeOnboarding(B, wsB);
    check(
      "incomplete tenant is told what's missing",
      bRes.ok === false &&
        bRes.missing.includes("growth.priorities") &&
        bRes.missing.includes("company.legal_name"),
    );

    // --- RLS isolation ------------------------------------------------------
    check(
      "B cannot read A's onboarding answers",
      Object.keys((await getOnboarding(B, wsA)).answers).length === 0,
    );
    let blocked = false;
    try {
      await saveOnboarding(B, wsA, { "company.legal_name": "hijack" });
    } catch {
      blocked = true;
    }
    check("B cannot write to A's onboarding (RLS)", blocked);
    state = await getOnboarding(A, wsA);
    check(
      "A's legal name is unchanged after B's attempt",
      state.answers["company.legal_name"] === "Verify Onboarding Ltd",
    );
  } finally {
    console.log("Cleanup…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ids));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ids));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      if (userA) await deleteUser(userA);
      if (userB) await deleteUser(userB);
      console.log("  done");
    } catch (e) {
      console.log(`  cleanup warning: ${(e as Error).message}`);
    }
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
