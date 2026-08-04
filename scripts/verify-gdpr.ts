/**
 * End-to-end verification of the GDPR (ROPA) module against the REAL Supabase
 * project: provision → processing-activity create → isolation → archive
 * (status) → cross-tenant block → hard delete → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-gdpr.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createProcessingActivity,
  deleteProcessingActivity,
  listProcessingActivities,
  updateProcessingActivity,
} from "../src/server/services/gdpr";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createProcessingActivitySchema } from "../src/shared/schemas/gdpr";

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
    userA = await createUser(`vg-a-${stamp}@example.test`);
    userB = await createUser(`vg-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VG A", workspaceName: "VG A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VG B", workspaceName: "VG B" },
    );

    const p = await createProcessingActivity({ sub: userA }, wsA, {
      activityName: "Customer enquiry handling",
      dataSubjects: "Customers, prospects",
      lawfulBasis: "legitimate_interests",
      specialCategoryData: false,
      internationalTransfers: true,
      retentionPeriod: "6 years",
    });
    check(
      "activity created for A",
      p?.activityName === "Customer enquiry handling" && p.status === "active",
    );
    check(
      "flags stored",
      p.internationalTransfers === true &&
        p.lawfulBasis === "legitimate_interests",
    );

    await createProcessingActivity({ sub: userB }, wsB, {
      activityName: "Payroll processing",
      lawfulBasis: "legal_obligation",
      specialCategoryData: true,
      internationalTransfers: false,
    });

    const aSees = await listProcessingActivities({ sub: userA });
    const bSees = await listProcessingActivities({ sub: userB });
    check(
      "A sees exactly 1 activity",
      aSees.length === 1 && aSees[0].id === p.id,
    );
    check("B sees exactly 1 activity", bSees.length === 1);
    check(
      "A does NOT see B's activity",
      !aSees.some((x) => x.activityName === "Payroll processing"),
    );

    const arch = await updateProcessingActivity({ sub: userA }, p.id, {
      status: "archived",
    });
    check("A can archive activity", arch?.status === "archived");

    let blocked = false;
    try {
      await createProcessingActivity(
        { sub: userA },
        wsB,
        createProcessingActivitySchema.parse({
          activityName: "hack",
        }),
      );
    } catch {
      blocked = true;
    }
    check("A cannot create in B's workspace (RLS)", blocked);

    const hijack = await updateProcessingActivity({ sub: userB }, p.id, {
      activityName: "hijacked",
    });
    check("B cannot update A's activity (row hidden)", hijack === null);

    check(
      "A can hard-delete own activity",
      (await deleteProcessingActivity({ sub: userA }, p.id)) === true,
    );
    check(
      "deleted activity no longer listed",
      (await listProcessingActivities({ sub: userA })).length === 0,
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
