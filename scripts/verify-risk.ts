/**
 * End-to-end verification of the Risk module against the REAL Supabase project:
 * provision → risk create with computed scores → isolation → status/update
 * (recompute) → cross-tenant block → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-risk.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  addRiskMitigation,
  createRisk,
  deleteRisk,
  listRisks,
  setRiskMitigationDone,
  setRiskStatus,
  updateRisk,
} from "../src/server/services/risk";
import { provisionWorkspace } from "../src/server/services/provisioning";

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
    userA = await createUser(`vr-a-${stamp}@example.test`);
    userB = await createUser(`vr-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VR A", workspaceName: "VR A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VR B", workspaceName: "VR B" },
    );

    const r = await createRisk({ sub: userA }, wsA, {
      riskTitle: "Key supplier concentration",
      riskCategory: "supplier",
      likelihood: 4,
      impact: 5,
      residualLikelihood: 2,
      residualImpact: 2,
      controlEffectiveness: "adequate",
      response: "reduce",
    });
    check(
      "inherent score/rating computed (20 / critical)",
      r?.inherentScore === 20 && r.inherentRating === "critical",
    );
    check(
      "residual score/rating computed (4 / low)",
      r.residualScore === 4 && r.residualRating === "low",
    );

    await createRisk({ sub: userB }, wsB, {
      riskTitle: "Cashflow gap",
      riskCategory: "financial",
      likelihood: 3,
      impact: 3,
      residualLikelihood: 2,
      residualImpact: 2,
      controlEffectiveness: "weak",
      response: "monitor",
    });

    const aSees = await listRisks({ sub: userA });
    const bSees = await listRisks({ sub: userB });
    check("A sees exactly 1 risk", aSees.length === 1 && aSees[0].id === r.id);
    check("B sees exactly 1 risk", bSees.length === 1);
    check(
      "A does NOT see B's risk",
      !aSees.some((x) => x.riskTitle === "Cashflow gap"),
    );

    const acc = await setRiskStatus(
      { sub: userA },
      r.id,
      "accepted",
      "Backup supplier engaged",
    );
    check(
      "A can accept risk (timestamp + reason)",
      acc?.status === "accepted" && acc.acceptedAt !== null,
    );

    const upd = await updateRisk({ sub: userA }, r.id, { likelihood: 3 });
    check(
      "update recomputes inherent (3×5 = 15 / high)",
      upd?.inherentScore === 15 && upd.inherentRating === "high",
    );

    let blocked = false;
    try {
      await createRisk({ sub: userA }, wsB, {
        riskTitle: "hack",
        riskCategory: "operational",
        likelihood: 1,
        impact: 1,
        residualLikelihood: 1,
        residualImpact: 1,
        controlEffectiveness: "none",
        response: "monitor",
      });
    } catch {
      blocked = true;
    }
    check("A cannot create in B's workspace (RLS)", blocked);

    const hijack = await updateRisk({ sub: userB }, r.id, {
      riskTitle: "hijacked",
    });
    check("B cannot update A's risk (row hidden)", hijack === null);

    // --- Mitigation/treatment actions ---
    const withMit = await addRiskMitigation({ sub: userA }, r.id, {
      label: "Qualify a second supplier",
      dueDate: "2026-09-30",
    });
    check(
      "mitigation added with due date",
      withMit?.mitigations.length === 1 &&
        withMit.mitigations[0].label === "Qualify a second supplier" &&
        withMit.mitigations[0].dueDate === "2026-09-30" &&
        withMit.mitigations[0].completedAt === null,
    );
    const mitId = withMit!.mitigations[0].id;
    const done = await setRiskMitigationDone({ sub: userA }, r.id, mitId, true);
    check(
      "mitigation can be completed (timestamp set)",
      done?.mitigations[0].completedAt !== null,
    );
    const reopened = await setRiskMitigationDone(
      { sub: userA },
      r.id,
      mitId,
      false,
    );
    check(
      "mitigation can be reopened",
      reopened?.mitigations[0].completedAt === null,
    );
    check(
      "B cannot add mitigations to A's risk (row hidden)",
      (await addRiskMitigation({ sub: userB }, r.id, { label: "hack" })) ===
        null,
    );

    check(
      "A can soft-delete own risk",
      (await deleteRisk({ sub: userA }, r.id)) === true,
    );
    check(
      "deleted risk no longer listed",
      (await listRisks({ sub: userA })).length === 0,
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
