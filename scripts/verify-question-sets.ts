/**
 * End-to-end verification of platform-managed question sets against the REAL
 * Supabase project: defaults → override save → merged read → the GDPR
 * assessment engine actually scoring against the override → validation
 * rejects bad quizzes → reset restores defaults → anon RLS block → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-question-sets.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  organisations,
  platformQuestionSets,
  workspaces,
} from "../src/server/db/schema";
import {
  getQuestionSet,
  isQuestionSetOverridden,
  listQuestionSets,
  resetQuestionSet,
  saveQuestionSet,
} from "../src/server/services/question-sets";
import { saveGdprAssessment } from "../src/server/services/gdpr-registers";
import { saveReadinessAssessment } from "../src/server/services/investor-readiness";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { GDPR_CHECKLIST } from "../src/shared/schemas/gdpr-registers";
import {
  groupInvestorAssessment,
  INVESTOR_ASSESSMENT_ITEMS,
  type InvestorAssessmentItem,
} from "../src/shared/schemas/investor-readiness";
import { COURSES } from "../src/data/academy-catalog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

async function main() {
  const stamp = Date.now();
  let userA = "";
  let wsA = "";
  const touchedKeys: string[] = [];
  let preExisting: (typeof platformQuestionSets.$inferSelect)[] = [];

  try {
    // Snapshot any real admin overrides so cleanup can restore them.
    touchedKeys.push(
      "gdpr_health_check",
      "investor_assessment",
      `academy_quiz:${COURSES[0].id}`,
    );
    preExisting = await adminDb
      .select()
      .from(platformQuestionSets)
      .where(inArray(platformQuestionSets.id, touchedKeys));
    // --- Registry + defaults -------------------------------------------------
    const metas = listQuestionSets();
    check(
      "registry lists gdpr + tender + investor + one quiz per course",
      metas.some((m) => m.key === "gdpr_health_check") &&
        metas.some((m) => m.key === "tender_bid_checklist") &&
        metas.some((m) => m.key === "investor_assessment") &&
        COURSES.every((c) =>
          metas.some((m) => m.key === `academy_quiz:${c.id}`),
        ),
    );

    const gdprDefault = await getQuestionSet("gdpr_health_check");
    check(
      "default GDPR set matches code checklist",
      gdprDefault.length === GDPR_CHECKLIST.length &&
        !(await isQuestionSetOverridden("gdpr_health_check")),
    );

    // --- Override save + merged read ----------------------------------------
    const twoItems = [
      {
        label: "Do you have a privacy notice?",
        gap: "No privacy notice",
        recommendation: "Publish a privacy notice",
        priority: "high",
      },
      {
        label: "Is a records register maintained?",
        gap: "No ROPA",
        recommendation: "Maintain a ROPA",
        priority: "medium",
      },
    ];
    const saved = await saveQuestionSet(
      "gdpr_health_check",
      twoItems,
      "verify@test.local",
    );
    check("saveQuestionSet accepts a valid override", saved.ok);
    const merged = await getQuestionSet("gdpr_health_check");
    check(
      "getQuestionSet returns the override with stable keys",
      merged.length === 2 &&
        typeof merged[0].key === "string" &&
        (merged[0].key as string).length > 0 &&
        (await isQuestionSetOverridden("gdpr_health_check")),
    );

    // --- The engine scores against the override ------------------------------
    userA = await createUser(`vqs-a-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VQS A", workspaceName: "VQS A" },
    );
    const k0 = merged[0].key as string;
    const k1 = merged[1].key as string;
    const row = await saveGdprAssessment({ sub: userA }, wsA, {
      [k0]: "yes",
      [k1]: "no",
    });
    check(
      "saveGdprAssessment scores against the 2-question override (50%)",
      row.score === 50,
    );
    const gaps = (row.gaps ?? []) as string[];
    check(
      "gaps come from the overridden question, not the default list",
      gaps.length === 1 && gaps[0] === "No ROPA",
    );

    // --- Validation ----------------------------------------------------------
    const quizKey = `academy_quiz:${COURSES[0].id}`;
    const badQuiz = await saveQuestionSet(
      quizKey,
      [
        {
          question: "Pick one",
          options: ["A", "B"],
          correct_index: 5,
        },
      ],
      "verify@test.local",
    );
    check("quiz validator rejects correct_index beyond options", !badQuiz.ok);
    const goodQuiz = await saveQuestionSet(
      quizKey,
      [
        {
          question: "Pick the first option",
          options: ["Right", "Wrong"],
          correct_index: 0,
          explanation: "The first option is right.",
        },
      ],
      "verify@test.local",
    );
    const quizItems = await getQuestionSet(quizKey);
    check(
      "quiz override saved with generated ids",
      goodQuiz.ok &&
        quizItems.length === 1 &&
        typeof quizItems[0].id === "string",
    );

    const unknown = await saveQuestionSet("nope", [], "verify@test.local");
    check("unknown set key is rejected", !unknown.ok);

    // --- Investor assessment: override drives the wizard AND the engine ------
    const invDefault = await getQuestionSet("investor_assessment");
    check(
      "default investor set matches the code wizard",
      invDefault.length === INVESTOR_ASSESSMENT_ITEMS.length,
    );
    const badInv = await saveQuestionSet(
      "investor_assessment",
      [{ text: "Broken", dim: "not_a_dimension" }],
      "verify@test.local",
    );
    check("investor validator rejects an unknown dimension", !badInv.ok);
    const invSaved = await saveQuestionSet(
      "investor_assessment",
      [
        {
          text: "Do you have a cap table?",
          dim: "corporate",
          redFlag: true,
        },
        { text: "Are accounts filed?", dim: "financial" },
      ],
      "verify@test.local",
    );
    const invItems = (await getQuestionSet(
      "investor_assessment",
    )) as unknown as InvestorAssessmentItem[];
    const invSteps = groupInvestorAssessment(invItems);
    check(
      "investor override groups into wizard steps by dimension",
      invSaved.ok &&
        invSteps.length === 2 &&
        invSteps[0].dim === "corporate" &&
        invSteps[0].questions[0].redFlag === true,
    );
    const invRow = await saveReadinessAssessment({ sub: userA }, wsA, {
      [invItems[0].id]: "no",
      [invItems[1].id]: "yes",
    });
    check(
      "saveReadinessAssessment scores against the 2-question override (50%)",
      invRow.overallScore === 50 &&
        invRow.corporateScore === 0 &&
        invRow.financialScore === 100,
    );
    const invFlags = (invRow.redFlags ?? []) as string[];
    check(
      "red flag comes from the overridden question",
      invFlags.length === 1 && invFlags[0] === "Do you have a cap table?",
    );
    await resetQuestionSet("investor_assessment");
    const invRestored = await getQuestionSet("investor_assessment");
    check(
      "investor reset falls back to the code default",
      invRestored.length === INVESTOR_ASSESSMENT_ITEMS.length,
    );

    // --- Reset restores defaults --------------------------------------------
    await resetQuestionSet("gdpr_health_check");
    await resetQuestionSet(quizKey);
    const restored = await getQuestionSet("gdpr_health_check");
    check(
      "reset falls back to the code default",
      restored.length === GDPR_CHECKLIST.length &&
        !(await isQuestionSetOverridden("gdpr_health_check")),
    );

    // --- RLS: table is service-role only -------------------------------------
    const anonRes = await fetch(
      `${SUPABASE_URL}/rest/v1/platform_question_sets?select=id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    const anonBody = anonRes.ok ? await anonRes.json() : [];
    check(
      "anon client cannot read platform_question_sets",
      !anonRes.ok || (Array.isArray(anonBody) && anonBody.length === 0),
    );
    const anonWrite = await fetch(
      `${SUPABASE_URL}/rest/v1/platform_question_sets`,
      {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: `vqs-${stamp}`, questions: [] }),
      },
    );
    check("anon client cannot write platform_question_sets", !anonWrite.ok);
  } finally {
    console.log("Cleanup…");
    try {
      await adminDb
        .delete(platformQuestionSets)
        .where(inArray(platformQuestionSets.id, touchedKeys));
      // Put back any real admin overrides that existed before this run.
      if (preExisting.length)
        await adminDb.insert(platformQuestionSets).values(preExisting);
      if (wsA) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(eq(workspaces.id, wsA));
        await adminDb.delete(workspaces).where(eq(workspaces.id, wsA));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      if (userA) await deleteUser(userA);
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
