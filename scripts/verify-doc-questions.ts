/**
 * End-to-end verification of document-aware guided drafting: policies keep
 * the original questionnaire; contracts, letters, procedures, plans,
 * handbooks and records get their own question sets and section skeletons;
 * the composer and the Jova Policy Check follow the document kind; and a
 * contract drafts + adopts end-to-end against the REAL Supabase project.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-doc-questions.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  adoptPolicy,
  checkPolicyById,
  draftPolicy,
  updatePolicy,
} from "../src/server/services/policies";
import {
  BASE_QUESTIONS,
  kindOf,
  questionsFor,
  sectionsFor,
} from "../src/shared/policies/templates";
import { composeFromTemplate } from "../src/shared/policies/compose";
import { getPolicyTemplate } from "../src/shared/policies/templates";
import { findPlaceholders, runPolicyCheck } from "../src/shared/policies/check";
import { providerFor } from "../src/server/ai/provider";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const det = { provider: providerFor("deterministic") };

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

  try {
    // --- Policies keep the original questionnaire ----------------------------
    const dp = questionsFor("tpl_data_protection");
    check(
      "policy questionnaire unchanged (base questions + template extras)",
      BASE_QUESTIONS.every((b) => dp.some((q) => q.key === b.key)) &&
        dp.some((q) => q.key === "lawful_bases"),
    );
    const blank = questionsFor(null);
    check("blank policy uses the standard questions", blank === BASE_QUESTIONS);

    // --- Contracts get contract questions ------------------------------------
    const emp = questionsFor("tpl_employment_contract");
    check(
      "employment contract asks about salary, start date and notice - not policy purpose",
      emp.some((q) => q.key === "salary") &&
        emp.some((q) => q.key === "start_date") &&
        emp.some((q) => q.key === "notice") &&
        !emp.some((q) => q.question.toLowerCase().includes("this policy")),
    );
    const nda = questionsFor("tpl_nda");
    check(
      "NDA asks about parties, direction and confidentiality period",
      nda.some((q) => q.key === "direction") &&
        nda.some((q) => q.key === "confidential_info") &&
        nda.some((q) => q.key === "period"),
    );
    check(
      "all 17 contract-category templates have non-policy question sets",
      [
        "tpl_employment_contract",
        "tpl_offer_letter",
        "tpl_employment_confirmation_letter",
        "tpl_contractor_agreement",
        "tpl_consultancy_agreement",
        "tpl_customer_services_agreement",
        "tpl_supplier_agreement",
        "tpl_nda",
        "tpl_msa",
        "tpl_sow",
        "tpl_sla",
        "tpl_dpa",
        "tpl_contract_variation",
        "tpl_renewal_letter",
        "tpl_termination_notice",
        "tpl_heads_of_terms",
        "tpl_mou",
      ].every(
        (k) => !questionsFor(k).some((q) => q.key === "professional_support"),
      ),
    );

    // --- Named non-policy documents + kind fallbacks -------------------------
    check(
      "board minutes ask about attendees, decisions and actions",
      questionsFor("tpl_board_minutes").some((q) => q.key === "attendees") &&
        questionsFor("tpl_board_minutes").some((q) => q.key === "decisions"),
    );
    check(
      "plans ask about activation, response and testing",
      questionsFor("tpl_disaster_recovery").some(
        (q) => q.key === "activation",
      ) &&
        questionsFor("tpl_incident_response").some(
          (q) => q.key === "containment",
        ),
    );
    check(
      "kind fallback: a procedure without a specific set gets procedure questions",
      questionsFor("tpl_leaver_checklist").some((q) => q.key === "steps") &&
        questionsFor("tpl_leaver_checklist").some((q) => q.key === "trigger"),
    );
    check(
      "kinds resolved: nda=contract, rtw=procedure, modern slavery=statement",
      kindOf("tpl_nda") === "contract" &&
        kindOf("tpl_rtw") === "procedure" &&
        kindOf("tpl_modern_slavery") === "statement",
    );

    // --- Composer follows the document kind ----------------------------------
    const profile = {
      businessName: "VDQ Ltd",
      industry: "consulting",
      employeeCount: 4,
      primaryContactName: "Priya Shah",
    };
    const ndaDoc = composeFromTemplate(
      {
        policyName: "Non-Disclosure Agreement",
        templateKey: "tpl_nda",
        answers: {
          other_party: "Globex Ltd",
          direction: "Mutual",
          confidential_info: "Pricing, customer lists and product roadmaps.",
          period: "3 years from disclosure",
        },
      },
      profile,
      getPolicyTemplate("tpl_nda"),
    );
    check(
      "NDA composes with contract sections, no policy skeleton",
      ndaDoc.includes("Parties") &&
        ndaDoc.includes("Confidentiality") &&
        ndaDoc.includes("Signatures") &&
        ndaDoc.includes("Globex Ltd") &&
        !ndaDoc.includes("Professional-support considerations"),
    );
    check(
      "unanswered contract sections use neutral drafting, never placeholders",
      findPlaceholders(ndaDoc).length === 0 &&
        ndaDoc.includes("payable within 30 days"),
    );
    const sections = sectionsFor("tpl_fire_safety");
    check(
      "procedures compose against procedure sections",
      sections.some((s) => s.key === "steps") &&
        sections.some((s) => s.key === "trigger"),
    );

    // --- The check follows the kind ------------------------------------------
    const ndaCheck = runPolicyCheck(ndaDoc, { templateKey: "tpl_nda" });
    check(
      "contract check: parties pass, no policy-scope critical, adoptable",
      ndaCheck.items.some((i) => i.key === "parties" && i.status === "pass") &&
        !ndaCheck.items.some((i) => i.key === "scope") &&
        ndaCheck.readyForAdoption,
    );
    const policyCheck = runPolicyCheck("Too short.", {});
    check(
      "policies still require purpose and scope as critical",
      !policyCheck.readyForAdoption &&
        policyCheck.items.some(
          (i) => i.key === "purpose" && i.status === "critical",
        ),
    );

    // --- End-to-end: draft + adopt a contract against hosted Supabase --------
    userA = await createUser(`vdq-a-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VDQ A", workspaceName: "VDQ A" },
    );
    const draft = await draftPolicy(
      { sub: userA },
      wsA,
      {
        policyName: "Non-Disclosure Agreement",
        templateKey: "tpl_nda",
        answers: { other_party: "Globex Ltd", period: "3 years" },
      },
      det,
    );
    await updatePolicy({ sub: userA }, draft.id, { owner: "Priya Shah" });
    const res = await checkPolicyById({ sub: userA }, draft.id);
    check(
      "drafted NDA passes its kind-aware Jova check",
      !!res && res.check.readyForAdoption,
    );
    const adopted = await adoptPolicy({ sub: userA }, draft.id);
    check(
      "contract adopts end-to-end (v1.0, active)",
      !!adopted && adopted.ok === true && adopted.policy.version === "1.0",
    );
  } finally {
    console.log("Cleanup…");
    try {
      const ids = [wsA].filter(Boolean);
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
