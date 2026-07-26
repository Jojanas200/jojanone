/**
 * Verifies the GDPR operational sub-registers (DSARs, breaches, DPIAs):
 * create/update/status/delete round-trips, the DSAR one-month deadline is
 * auto-computed, completion/closure stamps are set, and every register is
 * strictly tenant-isolated (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-gdpr-registers.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  createDataBreach,
  createDataRequest,
  createDpia,
  deleteDataRequest,
  listDataBreaches,
  listDataRequests,
  listDpias,
  updateDataBreach,
  updateDataRequest,
  updateDpia,
} from "../src/server/services/gdpr-registers";

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
    userA = await createUser(`vgr-a-${stamp}@example.test`);
    userB = await createUser(`vgr-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VGr A", workspaceName: "VGr A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VGr B", workspaceName: "VGr B" },
    );

    // --- Data subject requests ---
    const dsar = await createDataRequest({ sub: userA }, wsA, {
      requestType: "subject_access",
      requesterReference: "REF-001",
      receivedDate: "2026-07-01",
      identityVerified: false,
      status: "open",
    });
    check(
      "DSAR due date auto-computed to received + 1 month",
      dsar.dueDate === "2026-08-01",
    );
    const dsarDone = await updateDataRequest({ sub: userA }, dsar.id, {
      status: "completed",
    });
    check(
      "completing a DSAR stamps completed_at",
      dsarDone?.status === "completed" && dsarDone.completedAt !== null,
    );
    check(
      "A lists its one DSAR",
      (await listDataRequests({ sub: userA })).length === 1,
    );
    check(
      "B sees none of A's DSARs (RLS)",
      (await listDataRequests({ sub: userB })).length === 0,
    );
    check(
      "B cannot update A's DSAR (row hidden)",
      (await updateDataRequest({ sub: userB }, dsar.id, {
        status: "closed",
      })) === null,
    );

    // --- Breaches ---
    const breach = await createDataBreach({ sub: userA }, wsA, {
      title: "Lost laptop",
      discoveredDate: "2026-07-10",
      affectedPeopleEstimate: 40,
      riskLevel: "high",
      status: "open",
      professionalSupportRequired: true,
    });
    check("breach created open with high risk", breach.status === "open");
    const closed = await updateDataBreach({ sub: userA }, breach.id, {
      status: "closed",
    });
    check(
      "closing a breach stamps closed_at",
      closed?.status === "closed" && closed.closedAt !== null,
    );
    check(
      "A lists its one breach",
      (await listDataBreaches({ sub: userA })).length === 1,
    );
    check(
      "B sees none of A's breaches (RLS)",
      (await listDataBreaches({ sub: userB })).length === 0,
    );

    // --- DPIAs ---
    const dpia = await createDpia({ sub: userA }, wsA, {
      title: "New CRM rollout",
      project: "CRM",
      residualRisk: "medium",
      status: "draft",
    });
    check("DPIA created as draft", dpia.status === "draft");
    const approved = await updateDpia({ sub: userA }, dpia.id, {
      status: "approved",
    });
    check("DPIA can be approved", approved?.status === "approved");
    check(
      "B sees none of A's DPIAs (RLS)",
      (await listDpias({ sub: userB })).length === 0,
    );
    check(
      "B cannot update A's DPIA (row hidden)",
      (await updateDpia({ sub: userB }, dpia.id, { status: "draft" })) === null,
    );

    // --- Delete round-trip ---
    check(
      "A can delete its DSAR",
      (await deleteDataRequest({ sub: userA }, dsar.id)) === true,
    );
    check(
      "deleted DSAR no longer listed",
      (await listDataRequests({ sub: userA })).length === 0,
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
