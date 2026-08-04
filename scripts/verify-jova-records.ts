/**
 * End-to-end verification that Jova's retrieval sees ACTUAL RECORDS across
 * modules (the tester's cross-module intelligence report): create real records
 * for tenant A (contract with dates/notice/terms, risk with review date and
 * controls, employee, obligation, ROPA activity, supplier entity), then prove
 * retrieveContext surfaces the underlying detail, ranks by query, and that
 * tenant B sees none of it. Runs against the REAL Supabase project.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-jova-records.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { createContract } from "../src/server/services/contracts";
import { createRisk } from "../src/server/services/risk";
import { createEmployee } from "../src/server/services/hr";
import { createObligation } from "../src/server/services/compliance";
import { createProcessingActivity } from "../src/server/services/gdpr";
import { createEntity } from "../src/server/services/business-entities";
import { retrieveContext } from "../src/server/ai/retrieval";

import { createContractSchema } from "../src/shared/schemas/contract";

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

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vjr-a-${stamp}@example.test`);
    userB = await createUser(`vjr-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VJR A", workspaceName: "VJR A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VJR B", workspaceName: "VJR B" },
    );

    // The tester's exact scenario: a contract with dates, notice period,
    // obligations and key terms; a risk with review date, owner, controls,
    // likelihood and impact.
    await createContract(
      { sub: userA },
      wsA,
      createContractSchema.parse({
        contractType: "customer",
        title: "Northwind Services Agreement",
        counterparty: "Northwind Traders",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        noticePeriodDays: 60,
        keyTerms: "Exclusivity in the North East region; annual price review.",
        obligations: "Quarterly service report due within 10 working days.",
        owner: "Sam Field",
      }),
    );
    await createRisk({ sub: userA }, wsA, {
      riskTitle: "Single point of failure in dispatch software",
      riskCategory: "operational",
      likelihood: 4,
      impact: 5,
      residualLikelihood: 2,
      residualImpact: 2,
      controlEffectiveness: "adequate",
      riskOwner: "Priya Shah",
      reviewDate: "2026-09-15",
      controls: "Nightly backups and a documented manual dispatch fallback.",
      response: "reduce",
    });
    await createEmployee(
      { sub: userA },
      wsA,
      createEmployeeSchema.parse({
        fullName: "Jordan Blake",
        jobTitle: "Dispatch lead",
        employmentType: "employee",
        rightToWorkStatus: "verified",
        trainingStatus: "complete",
        riskLevel: "low",
      }),
    );
    await createObligation({ sub: userA }, wsA, {
      title: "Confirmation statement (CS01)",
      category: "companies_house",
      priority: "high",
      status: "upcoming",
      recurrence: "annual",
      dueDate: "2026-09-30",
      professionalSupportRequired: false,
    });
    await createProcessingActivity({ sub: userA }, wsA, {
      activityName: "Customer enquiry handling",
      dataSubjects: "Customers, prospects",
      lawfulBasis: "legitimate_interests",
      specialCategoryData: false,
      internationalTransfers: false,
      retentionPeriod: "6 years",
    });
    await createEntity({ sub: userA }, wsA, {
      entityType: "supplier",
      name: "Acme Logistics",
      status: "active",
      importance: "high",
      riskLevel: "medium",
    });

    // --- Record-level detail is in the context --------------------------------
    const ctx = await retrieveContext(
      { sub: userA },
      wsA,
      "what is the notice period on the Northwind contract?",
    );
    const text = ctx.contextText;
    check(
      "contract record with notice period + dates in context",
      text.includes("Northwind Services Agreement") &&
        text.includes("notice period 60 days") &&
        text.includes("2026-12-31"),
    );
    check(
      "contract key terms and obligations in context",
      text.includes("Exclusivity in the North East") &&
        text.includes("Quarterly service report"),
    );
    check(
      "risk record with review date, owner, controls, scores in context",
      text.includes("Single point of failure in dispatch software") &&
        text.includes("review date 2026-09-15") &&
        text.includes("Priya Shah") &&
        text.includes("likelihood 4 x impact 5") &&
        text.includes("manual dispatch fallback"),
    );
    check(
      "HR, compliance, GDPR and relationship records in context",
      text.includes("Jordan Blake") &&
        text.includes("Confirmation statement (CS01)") &&
        text.includes("Customer enquiry handling") &&
        text.includes("Acme Logistics"),
    );
    check(
      "records are cited as sources",
      ctx.sources.some((s) => s.label === "Northwind Services Agreement") &&
        ctx.sources.some(
          (s) => s.label === "Single point of failure in dispatch software",
        ),
    );

    // --- Query ranking: relevant record survives the per-module cap ----------
    for (let i = 0; i < 10; i++) {
      await createContract(
        { sub: userA },
        wsA,
        createContractSchema.parse({
          contractType: "supplier",
          title: `Filler contract ${i + 1}`,
        }),
      );
    }
    const ranked = await retrieveContext(
      { sub: userA },
      wsA,
      "northwind notice period",
    );
    check(
      "query-relevant contract survives the cap with 11 contracts",
      ranked.contextText.includes("Northwind Services Agreement") &&
        ranked.contextText.includes("showing 8 most relevant of 11"),
    );

    // --- Tenant isolation -----------------------------------------------------
    const ctxB = await retrieveContext(
      { sub: userB },
      wsB,
      "what is the notice period on the Northwind contract?",
    );
    check(
      "tenant B sees none of A's records",
      !ctxB.contextText.includes("Northwind") &&
        !ctxB.contextText.includes("Priya Shah") &&
        !ctxB.contextText.includes("Jordan Blake") &&
        !ctxB.contextText.includes("Acme Logistics"),
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
