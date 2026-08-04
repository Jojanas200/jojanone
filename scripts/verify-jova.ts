/**
 * Verifies the deterministic Jova rules engine: seeded data trips specific
 * rules with the right severity, resolving an item removes its finding
 * (determinism), and briefings are workspace-scoped.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-jova.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { createRisk } from "../src/server/services/risk";
import {
  createObligation,
  setObligationStatus,
} from "../src/server/services/compliance";
import { createProcessingActivity } from "../src/server/services/gdpr";
import { getJovaBriefing } from "../src/server/services/jova";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createObligationSchema } from "../src/shared/schemas/compliance";

import { createProcessingActivitySchema } from "../src/shared/schemas/gdpr";

import { createRiskSchema } from "../src/shared/schemas/risk";

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
    userA = await createUser(`vjo-a-${stamp}@example.test`);
    userB = await createUser(`vjo-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VJo A", workspaceName: "VJo A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VJo B", workspaceName: "VJo B" },
    );

    // A fresh workspace only trips the "profile incomplete" (low) rule.
    const fresh = await getJovaBriefing({ sub: userB });
    check(
      "fresh workspace yields exactly the profile-incomplete finding",
      fresh.total === 1 &&
        fresh.findings[0].id === "profile-incomplete" &&
        fresh.findings[0].severity === "low",
    );

    // Seed A with data that trips three distinct rules.
    await createRisk(
      { sub: userA },
      wsA,
      createRiskSchema.parse({
        riskTitle: "Data breach exposure",
        riskCategory: "cyber",
        likelihood: 5,
        impact: 5,
        residualLikelihood: 5,
        residualImpact: 5,
      }),
    );
    const ob = await createObligation(
      { sub: userA },
      wsA,
      createObligationSchema.parse({
        title: "Confirmation statement",
        category: "companies_house",
        status: "overdue",
      }),
    );
    await createProcessingActivity(
      { sub: userA },
      wsA,
      createProcessingActivitySchema.parse({
        activityName: "Health records",
        specialCategoryData: true,
      }),
    );

    const b1 = await getJovaBriefing({ sub: userA });
    check(
      "critical rule fires for a 25-score residual risk",
      b1.counts.critical === 1,
    );
    check(
      "two high findings (overdue obligation + special-category GDPR)",
      b1.counts.high === 2,
    );
    check("profile-incomplete low finding present", b1.counts.low === 1);
    check("total is 4 findings", b1.total === 4);
    check(
      "findings are severity-sorted (critical first)",
      b1.findings[0].severity === "critical",
    );
    check(
      "critical finding names the seeded risk",
      b1.findings[0].title.includes("Data breach exposure"),
    );
    check(
      "every finding carries an action and href",
      b1.findings.every((f) => f.action.length > 0 && f.href.startsWith("/")),
    );

    // Determinism: resolving the obligation removes exactly its finding.
    await setObligationStatus({ sub: userA }, ob.id, "completed");
    const b2 = await getJovaBriefing({ sub: userA });
    check(
      "resolving the obligation drops one high finding",
      b2.counts.high === 1,
    );
    check(
      "no compliance finding remains",
      !b2.findings.some((f) => f.module === "Compliance"),
    );

    // Cross-tenant: B never sees A's findings.
    const bB = await getJovaBriefing({ sub: userB });
    check(
      "B's briefing is unaffected by A's data",
      bB.total === 1 &&
        !bB.findings.some((f) => f.title.includes("Data breach")),
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
