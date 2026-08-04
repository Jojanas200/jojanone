/**
 * Verifies tender readiness: requirements + responses register CRUD and the
 * dimension-scored bid/no-bid decision, all tenant isolated (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-tender-readiness.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  createTenderRequirement,
  createTenderResponse,
  deleteTenderRequirement,
  generateTenderReport,
  getBidAssessment,
  getTenderReadiness,
  listTenderRequirements,
  listTenderResponses,
  saveBidAssessment,
  updateTenderRequirement,
} from "../src/server/services/tender-readiness";
import {
  addTenderChecklistItem,
  createTenderOpportunity,
  setTenderChecklistItem,
} from "../src/server/services/tender";

import { createTenderResponseSchema } from "../src/shared/schemas/tender-readiness";

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
    userA = await createUser(`vtr-a-${stamp}@example.test`);
    userB = await createUser(`vtr-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VTr A", workspaceName: "VTr A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VTr B", workspaceName: "VTr B" },
    );

    // --- Requirements ---
    const req = await createTenderRequirement({ sub: userA }, wsA, {
      requirementType: "accreditation",
      title: "ISO 27001",
      mandatory: true,
      weighting: 20,
      status: "not_started",
    });
    check("requirement created", req.title === "ISO 27001");
    const met = await updateTenderRequirement({ sub: userA }, req.id, {
      status: "met",
    });
    check("requirement status update persists", met?.status === "met");
    check(
      "A lists its one requirement",
      (await listTenderRequirements({ sub: userA })).length === 1,
    );
    check(
      "B sees no requirements (RLS)",
      (await listTenderRequirements({ sub: userB })).length === 0,
    );

    // --- Responses ---
    const resp = await createTenderResponse(
      { sub: userA },
      wsA,
      createTenderResponseSchema.parse({
        sectionTitle: "Method statement",
        wordLimit: 500,
        responseText: "Our approach is...",
        status: "draft",
      }),
    );
    check("response created", resp.sectionTitle === "Method statement");
    check(
      "A lists its one response",
      (await listTenderResponses({ sub: userA })).length === 1,
    );
    check(
      "B sees no responses (RLS)",
      (await listTenderResponses({ sub: userB })).length === 0,
    );

    // --- Bid assessment (dimension scored + recommendation) ---
    const bid = await saveBidAssessment({ sub: userA }, wsA, {
      answers: {
        aligned: true,
        reference_client: true,
        eligible: true,
        accreditations: true,
        capacity_deliver: true,
        team_available: true,
        case_studies: true,
        policies_ready: true,
        price_viable: true,
        payment_terms: true,
        risk_understood: true,
        risk_mitigated: true,
      },
    });
    check("full checklist scores 100", bid.overallScore === 100);
    check("full checklist recommends bid", bid.recommendation === "bid");
    const bid2 = await saveBidAssessment({ sub: userA }, wsA, {
      answers: { aligned: true },
      decision: "no_bid",
      decisionReason: "Not enough capacity",
    });
    check("re-saving updates the same record", bid2.id === bid.id);
    check(
      "sparse checklist recommends no_bid",
      bid2.overallScore < 40 && bid2.recommendation === "no_bid",
    );
    check("decision is recorded", bid2.decision === "no_bid");
    check(
      "B has no bid assessment (RLS)",
      (await getBidAssessment({ sub: userB })) === null,
    );

    // --- Full-field opportunity + requirement/response linkage ---
    const opp = await createTenderOpportunity({ sub: userA }, wsA, {
      title: "Leisure centre FM",
      authority: "City Council",
      reference: "CF-2026-101",
      sector: "Facilities",
      location: "Leeds",
      contractValue: 50000000,
      currency: "GBP",
      publicationDate: "2026-07-01",
      clarificationDeadline: "2026-07-20",
      submissionDeadline: "2026-08-01",
      contractStartDate: "2026-10-01",
      contractDuration: "3 years + 1",
      procedureType: "restricted",
      status: "assessing",
      source: "Find a Tender",
      summary: "Full facilities management for two leisure centres.",
      eligibilityNotes: "ISO 9001 required; 2x contract value insurance.",
      owner: "Bid team",
    });
    check(
      "full-field opportunity persists",
      opp.reference === "CF-2026-101" &&
        opp.clarificationDeadline === "2026-07-20" &&
        opp.contractDuration === "3 years + 1" &&
        opp.eligibilityNotes ===
          "ISO 9001 required; 2x contract value insurance.",
    );
    const linkedReq = await createTenderRequirement({ sub: userA }, wsA, {
      opportunityId: opp.id,
      requirementType: "accreditation",
      title: "ISO 9001 certificate",
      mandatory: true,
      weighting: 10,
      status: "not_started",
    });
    check(
      "requirement links to its opportunity",
      linkedReq.opportunityId === opp.id,
    );
    const linkedResp = await createTenderResponse(
      { sub: userA },
      wsA,
      createTenderResponseSchema.parse({
        opportunityId: opp.id,
        sectionTitle: "Quality assurance",
        wordLimit: 300,
        responseText: "Our QA approach is...",
        status: "draft",
      }),
    );
    check(
      "response links to its opportunity",
      linkedResp.opportunityId === opp.id,
    );
    const v2 = await createTenderResponse({ sub: userA }, wsA, {
      opportunityId: opp.id,
      version: 2,
      sectionTitle: "Quality assurance",
      wordLimit: 300,
      responseText: "Our QA approach is... (revised)",
      status: "draft",
    });
    check("a second response version persists", v2.version === 2);

    // --- Submission checklist (embedded on the opportunity) ---
    const withItem = await addTenderChecklistItem({ sub: userA }, opp.id, {
      label: "Signed form of tender",
      mandatory: true,
    });
    check(
      "checklist item added (mandatory, not done)",
      withItem?.checklist.length === 1 &&
        withItem.checklist[0].mandatory === true &&
        withItem.checklist[0].done === false,
    );
    const ticked = await setTenderChecklistItem(
      { sub: userA },
      opp.id,
      withItem!.checklist[0].id,
      true,
    );
    check("checklist item can be ticked", ticked?.checklist[0].done === true);
    check(
      "B cannot touch A's checklist (row hidden)",
      (await addTenderChecklistItem({ sub: userB }, opp.id, {
        label: "hack",
        mandatory: false,
      })) === null,
    );

    // --- Readiness score + report ---
    const readiness = await getTenderReadiness({ sub: userA });
    check(
      "readiness score is within range",
      readiness.readinessScore >= 0 && readiness.readinessScore <= 100,
    );
    check(
      "no obligations means compliance is on track",
      readiness.complianceOk === true,
    );
    check(
      "pipeline metrics are computed",
      typeof readiness.metrics.activeOpps === "number" &&
        typeof readiness.metrics.reqIncomplete === "number",
    );
    const report = await generateTenderReport({ sub: userA }, wsA);
    check(
      "a tender readiness report is generated",
      !!report.id && report.title.startsWith("Tender Readiness Report"),
    );

    // --- Delete round-trip ---
    check(
      "A can delete a requirement",
      (await deleteTenderRequirement({ sub: userA }, req.id)) === true,
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
