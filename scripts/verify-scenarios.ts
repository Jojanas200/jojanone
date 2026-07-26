/**
 * Verifies decision scenarios (scenario_runs): a run computes readiness from the
 * playbook and records outstanding items; list/delete round-trip; tenant
 * isolated (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-scenarios.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  createScenarioRun,
  deleteScenarioRun,
  listScenarioRuns,
} from "../src/server/services/scenarios";

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
    userA = await createUser(`vsc-a-${stamp}@example.test`);
    userB = await createUser(`vsc-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VSc A", workspaceName: "VSc A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VSc B", workspaceName: "VSc B" },
    );

    // hire_employee has 6 considerations; 3 handled -> 50% readiness.
    const run = await createScenarioRun({ sub: userA }, wsA, {
      scenarioType: "hire_employee",
      scenarioName: "First developer",
      answers: { rtw: true, contract: true, payroll: true },
    });
    const result = run.result as {
      readiness: number;
      outstanding: string[];
    };
    check(
      "scenario readiness computed from the playbook",
      result.readiness === 50,
    );
    check(
      "outstanding considerations recorded",
      result.outstanding.length === 3,
    );
    check("run stored as complete", run.status === "complete");

    // --- Advisory engine: typed answers + conditional rules ---
    const rich = await createScenarioRun({ sub: userA }, wsA, {
      scenarioType: "engage_contractor",
      scenarioName: "Fractional CTO",
      answers: {
        role: "Fractional CTO",
        ir35: "inside",
        engagement_length: "3_to_12_months",
        contract: true,
        insurance: true,
        ip: true,
      },
    });
    const rr = rich.result as unknown as {
      impact: string;
      summary: string;
      risks: string[];
      actions: { label: string; priority: string; module: string }[];
      affectedModules: string[];
    };
    check(
      "typed answers persist on the run",
      (rich.answers as Record<string, unknown>).role === "Fractional CTO",
    );
    check(
      "advisory result computed (impact + summary)",
      rr.impact === "high" && rr.summary.includes("Fractional CTO"),
    );
    check(
      "conditional rule fires (inside IR35 -> payroll action)",
      rr.actions.some((x) => x.label.toLowerCase().includes("payroll")) &&
        rr.risks.some((x) => x.includes("Inside IR35")),
    );
    check(
      "A can delete the engine run",
      (await deleteScenarioRun({ sub: userA }, rich.id)) === true,
    );

    check(
      "A lists its one scenario",
      (await listScenarioRuns({ sub: userA })).length === 1,
    );
    check(
      "B sees no scenarios (RLS)",
      (await listScenarioRuns({ sub: userB })).length === 0,
    );

    check(
      "A can delete its scenario",
      (await deleteScenarioRun({ sub: userA }, run.id)) === true,
    );
    check(
      "deleted scenario no longer listed",
      (await listScenarioRuns({ sub: userA })).length === 0,
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
