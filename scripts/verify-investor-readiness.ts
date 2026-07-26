/**
 * Verifies investor readiness: the single-current profile upsert, the data-room
 * register CRUD, and the dimension-scored readiness assessment, all tenant
 * isolated (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-investor-readiness.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  createDataRoomItem,
  deleteDataRoomItem,
  generateInvestorReport,
  getInvestorProfile,
  getReadinessAssessment,
  listDataRoomItems,
  saveInvestorProfile,
  saveReadinessAssessment,
} from "../src/server/services/investor-readiness";
import {
  createDueDiligenceItem,
  deleteDueDiligenceItem,
  updateDueDiligenceItem,
} from "../src/server/services/investor";

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

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vir-a-${stamp}@example.test`);
    userB = await createUser(`vir-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VIr A", workspaceName: "VIr A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VIr B", workspaceName: "VIr B" },
    );

    // --- Profile upsert ---
    const p1 = await saveInvestorProfile({ sub: userA }, wsA, {
      fundingStage: "seed",
      amountSought: 500000,
      currency: "GBP",
      investmentType: "equity",
      status: "preparing",
    });
    check(
      "profile created",
      p1.fundingStage === "seed" && p1.amountSought === 500000,
    );
    const p2 = await saveInvestorProfile({ sub: userA }, wsA, {
      fundingStage: "series_a",
      amountSought: 2000000,
      currency: "GBP",
      investmentType: "equity",
      status: "live",
    });
    check("saving profile again updates the same record", p2.id === p1.id);
    check(
      "B has no profile (RLS)",
      (await getInvestorProfile({ sub: userB })) === null,
    );

    // --- Data room ---
    const doc = await createDataRoomItem({ sub: userA }, wsA, {
      folder: "Corporate",
      title: "Cap table",
      version: "1.0",
      status: "missing",
      confidentiality: "confidential",
    });
    check("data-room item created", doc.title === "Cap table");
    check(
      "A lists its one data-room item",
      (await listDataRoomItems({ sub: userA })).length === 1,
    );
    check(
      "B sees no data-room items (RLS)",
      (await listDataRoomItems({ sub: userB })).length === 0,
    );
    check(
      "A can delete a data-room item",
      (await deleteDataRoomItem({ sub: userA }, doc.id)) === true,
    );

    // --- Due-diligence item with the full field set ---
    const dd = await createDueDiligenceItem({ sub: userA }, wsA, {
      title: "Audited accounts (3 years)",
      category: "financial",
      description: "Statutory accounts plus management accounts.",
      required: true,
      status: "missing",
      owner: "Finance lead",
      priority: "high",
      evidenceReference: "SharePoint /finance/accounts",
      notes: "FY24 audit in progress.",
      reviewDate: "2026-09-01",
    });
    check(
      "DD item persists rich fields",
      dd.description === "Statutory accounts plus management accounts." &&
        dd.evidenceReference === "SharePoint /finance/accounts" &&
        dd.reviewDate === "2026-09-01" &&
        dd.priority === "high",
    );
    const ddNa = await updateDueDiligenceItem({ sub: userA }, dd.id, {
      status: "not_applicable",
      notes: "Marked N/A: pre-revenue, no audit requirement.",
    });
    check(
      "DD item can be marked N/A with a recorded reason",
      ddNa?.status === "not_applicable" &&
        (ddNa.notes ?? "").includes("Marked N/A"),
    );
    check(
      "A can delete the DD item",
      (await deleteDueDiligenceItem({ sub: userA }, dd.id)) === true,
    );

    // --- Readiness assessment (wizard answers, weighted scoring) ---
    // yes = 1, partial = 0.5, no/unsure = 0, na excluded from the denominator.
    const r = await saveReadinessAssessment({ sub: userA }, wsA, {
      // corporate: all yes -> 100
      q_incorp: "yes",
      q_psc: "yes",
      q_captable: "yes",
      // financial: q_accounts NO (red flag) -> (0+1+1+1)/4 = 75
      q_accounts: "no",
      q_mgmt: "yes",
      q_forecast: "yes",
      q_tax: "yes",
      // legal: one partial -> (1+0.5+1)/3 = 83
      q_contracts: "yes",
      q_ip: "partial",
      q_disputes: "yes",
      q_gdpr: "yes",
      q_reg: "yes",
      q_insurance: "yes",
      q_plan: "yes",
      q_traction: "yes",
      q_market: "yes",
      // people: all N/A -> excluded, score 0
      q_emp: "na",
      q_contractor: "na",
      q_dr_index: "yes",
      q_dr_pitch: "yes",
    });
    check("corporate dimension all-yes scores 100", r.corporateScore === 100);
    check(
      "a 'no' lowers the dimension (financial 75)",
      r.financialScore === 75,
    );
    check("partial counts as half (legal 83)", r.legalScore === 83);
    check("a fully N/A dimension is excluded (people 0)", r.peopleScore === 0);
    check(
      "overall is weighted across answered questions (92)",
      r.overallScore === 92,
    );
    check(
      "a 'no' on a red-flag question surfaces it",
      r.redFlags.includes("Are your last statutory accounts filed?"),
    );
    check("no/partial answers become gaps", r.gaps.length === 2);
    check(
      "recommended actions are derived from the gaps",
      r.recommendedActions.length === 2 &&
        (r.recommendedActions as string[])[0].startsWith("Address:"),
    );
    const got = await getReadinessAssessment({ sub: userA });
    check("readiness assessment is persisted", got?.id === r.id);
    check(
      "B has no readiness assessment (RLS)",
      (await getReadinessAssessment({ sub: userB })) === null,
    );

    // --- Generate report ---
    const report = await generateInvestorReport({ sub: userA }, wsA);
    check(
      "an investor readiness report is generated",
      !!report.id && report.title.startsWith("Investor Readiness Report"),
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
