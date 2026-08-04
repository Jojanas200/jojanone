/**
 * Verifies the evidence confirmation workflow: confirming evidence for an
 * obligation records a linked evidence item AND completes the obligation
 * atomically, emits an audit event, and is tenant-scoped.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-evidence.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb, withUser } from "../src/server/db";
import {
  complianceObligations,
  organisations,
  workspaces,
} from "../src/server/db/schema";
import { createObligation } from "../src/server/services/compliance";
import {
  confirmObligationEvidence,
  listEvidence,
  listObligationEvidence,
} from "../src/server/services/evidence";
import { listActivities } from "../src/server/services/activity";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createObligationSchema } from "../src/shared/schemas/compliance";

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
    userA = await createUser(`vev-a-${stamp}@example.test`);
    userB = await createUser(`vev-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VEv A", workspaceName: "VEv A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VEv B", workspaceName: "VEv B" },
    );

    const ob = await createObligation(
      { sub: userA },
      wsA,
      createObligationSchema.parse({
        title: "Confirmation statement",
        category: "companies_house",
        status: "action_required",
      }),
    );

    // Standalone evidence first: recorded WITHOUT completing the obligation.
    const partial = await confirmObligationEvidence({ sub: userA }, ob.id, {
      title: "Draft CS01 prepared",
      category: "compliance",
      completeObligation: false,
    });
    check(
      "standalone evidence records without completing",
      !!partial?.evidenceId && partial.obligationCompleted === false,
    );
    const [still] = await withUser({ sub: userA }, (tx) =>
      tx
        .select({ status: complianceObligations.status })
        .from(complianceObligations)
        .where(eq(complianceObligations.id, ob.id)),
    );
    check(
      "obligation stays in progress after standalone evidence",
      still.status === "action_required",
    );

    const result = await confirmObligationEvidence({ sub: userA }, ob.id, {
      title: "CS01 filed at Companies House",
      category: "compliance",
      notes: "Filed 17 Jul, receipt CS-2026-0042",
      fileName: "CS01-receipt.pdf",
      completeObligation: true,
    });
    check("confirmation returns an evidence id", !!result?.evidenceId);
    check(
      "obligation reported completed",
      result?.obligationCompleted === true,
    );

    // The obligation is now completed with evidence status + timestamp.
    const [row] = await withUser({ sub: userA }, (tx) =>
      tx
        .select({
          status: complianceObligations.status,
          evidenceStatus: complianceObligations.evidenceStatus,
          completedAt: complianceObligations.completedAt,
        })
        .from(complianceObligations)
        .where(eq(complianceObligations.id, ob.id)),
    );
    check("obligation status is completed", row.status === "completed");
    check("evidence status is complete", row.evidenceStatus === "complete");
    check("completed_at was stamped", row.completedAt !== null);

    // Both evidence items are in A's library, linked to the obligation.
    const lib = await listEvidence({ sub: userA });
    check(
      "evidence items recorded + linked to the obligation",
      lib.length === 2 &&
        lib.every(
          (e) => e.sourceModule === "compliance" && e.sourceRecordId === ob.id,
        ) &&
        lib.some((e) => e.fileName === "CS01-receipt.pdf"),
    );

    // The obligation-scoped evidence list returns both items for A,
    // and nothing for B (RLS).
    const obEvidence = await listObligationEvidence({ sub: userA }, ob.id);
    check(
      "obligation-scoped evidence returns both linked items",
      obEvidence.length === 2 &&
        obEvidence.some((e) => e.title.startsWith("CS01 filed")) &&
        obEvidence.some((e) => e.title.startsWith("Draft CS01")),
    );
    check(
      "B sees no evidence for A's obligation",
      (await listObligationEvidence({ sub: userB }, ob.id)).length === 0,
    );

    // Audit trail shows the completion-with-evidence.
    const feed = await listActivities({ sub: userA }, 10);
    check(
      "audit event recorded for the completion",
      feed.some(
        (a) =>
          a.title === "Confirmation statement" &&
          a.description === "Completed with evidence recorded",
      ),
    );

    // Cross-tenant: B cannot confirm evidence on A's obligation (RLS hides it).
    const foreign = await confirmObligationEvidence({ sub: userB }, ob.id, {
      title: "hijack",
      category: "compliance",
      completeObligation: true,
    });
    check("B cannot confirm evidence on A's obligation", foreign === null);
    check(
      "B's evidence library is empty",
      (await listEvidence({ sub: userB })).length === 0,
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
