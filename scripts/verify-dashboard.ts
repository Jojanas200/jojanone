/**
 * Verifies the Business Confidence Score against the REAL Supabase project:
 * clean baseline = 100 / Good; issues push the score down and populate metrics;
 * and the snapshot only reflects the caller's own workspace (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-dashboard.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { getSnapshot } from "../src/server/services/dashboard";
import {
  onboardingProgress,
  resumeSectionIndex,
} from "../src/shared/onboarding/logic";
import { createObligation } from "../src/server/services/compliance";
import { createRisk } from "../src/server/services/risk";
import { createEmployee } from "../src/server/services/hr";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createEmployeeSchema } from "../src/shared/schemas/hr";

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

async function criticalRisk(sub: string, ws: string, title: string) {
  return createRisk({ sub }, ws, {
    riskTitle: title,
    riskCategory: "operational",
    likelihood: 5,
    impact: 5,
    residualLikelihood: 5,
    residualImpact: 5,
    controlEffectiveness: "weak",
    response: "reduce",
  });
}

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vd-a-${stamp}@example.test`);
    userB = await createUser(`vd-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VD A", workspaceName: "VD A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VD B", workspaceName: "VD B" },
    );

    // A brand-new workspace must NOT be scored: no default 100, no default 0.
    const base = await getSnapshot({ sub: userA });
    check(
      "empty workspace is not assessed and has no score",
      base.assessed === false &&
        base.score === null &&
        base.statusLabel === null,
    );
    check(
      "onboarding reported separately, at 0% and not started",
      base.onboarding.started === false &&
        base.onboarding.percent === 0 &&
        base.onboarding.resumeStep === 0,
    );
    check(
      "no next step is invented while assessment is pending",
      base.nextStep === null,
    );

    // Add issues to A: 2 overdue obligations, 3 critical risks, 1 RTW gap.
    await createObligation({ sub: userA }, wsA, {
      title: "CS01",
      category: "companies_house",
      status: "overdue",
      priority: "high",
      recurrence: "annual",
      professionalSupportRequired: false,
    });
    await createObligation({ sub: userA }, wsA, {
      title: "VAT return",
      category: "vat",
      status: "overdue",
      priority: "high",
      recurrence: "quarterly",
      professionalSupportRequired: false,
    });
    await criticalRisk(userA, wsA, "Data breach exposure");
    await criticalRisk(userA, wsA, "Key person dependency");
    await criticalRisk(userA, wsA, "Cashflow shock");
    await createEmployee(
      { sub: userA },
      wsA,
      createEmployeeSchema.parse({
        fullName: "New Starter",
        rightToWorkStatus: "outstanding",
      }),
    );

    const s = await getSnapshot({ sub: userA });
    const complianceArea = s.areas.find((a) => a.key === "compliance");
    check(
      "open issues pull the compliance area down from its coverage",
      !!complianceArea && complianceArea.covered && complianceArea.score < 100,
    );
    check("overdue obligations metric = 2", s.metrics.overdueObligations === 2);
    check("critical/high risks metric = 3", s.metrics.criticalHighRisks === 3);
    check("people gaps metric >= 1", s.metrics.peopleGaps >= 1);
    check("priority actions surfaced", s.priorities.length > 0);
    const riskArea = s.areas.find((a) => a.key === "risk");
    check("risk area score reduced", !!riskArea && riskArea.score < 100);

    // B has its own critical risk - must NOT affect A's snapshot.
    await criticalRisk(userB, wsB, "B-only risk");
    const s2 = await getSnapshot({ sub: userA });
    check(
      "A's snapshot excludes B's data (isolation)",
      s2.metrics.criticalHighRisks === 3,
    );

    // --- The score model itself ---------------------------------------------
    check(
      "enough records now assessed, with a real number",
      s2.assessed === true &&
        typeof s2.score === "number" &&
        s2.statusLabel !== null,
    );
    check("score is never a default 100", s2.score !== 100);
    const empties = s2.areas.filter((a) => a.applicable && !a.covered);
    check(
      "untouched modules score 0 rather than a free 100",
      empties.length > 0 && empties.every((a) => a.score === 0),
    );
    const contractsArea = s2.areas.find((a) => a.key === "contracts");
    check(
      "an empty contracts register reads as not started",
      !!contractsArea &&
        contractsArea.covered === false &&
        contractsArea.score === 0 &&
        contractsArea.note.toLowerCase().includes("no contracts"),
    );
    check(
      "documents & evidence is scored as its own area",
      s2.areas.some((a) => a.key === "documents"),
    );
    check(
      "why-this-score explains itself",
      s2.needsAttention.length > 0 &&
        s2.nextStep !== null &&
        s2.nextStep.label.length > 0,
    );
    check(
      "onboarding progress stays separate from confidence",
      s2.onboarding.completed === false && s2.onboarding.percent < 100,
    );

    // --- Onboarding progress + resume (pure) --------------------------------
    const empty = onboardingProgress({});
    check(
      "progress over an empty questionnaire is 0% of a real total",
      empty.percent === 0 && empty.total > 0 && empty.answered === 0,
    );
    check(
      "resume starts at the first section for an untouched account",
      resumeSectionIndex({}) === 0,
    );
    const partial = onboardingProgress({ "owner.full_name": "Jordan Blake" });
    check(
      "answering a question moves progress off zero",
      partial.answered >= 1 && partial.percent > 0 && partial.percent < 100,
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
