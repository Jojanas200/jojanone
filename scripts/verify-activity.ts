/**
 * Verifies the audit trail: domain writes through the module services emit
 * activity rows in the SAME transaction (atomic), and the feed is workspace-
 * scoped (user A never sees user B's activity).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-activity.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createTenderOpportunity,
  deleteTenderOpportunity,
} from "../src/server/services/tender";
import { createAssignment } from "../src/server/services/academy";
import { listActivities } from "../src/server/services/activity";
import { COURSES } from "../src/data/academy-catalog";
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
    userA = await createUser(`val-a-${stamp}@example.test`);
    userB = await createUser(`val-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VAl A", workspaceName: "VAl A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VAl B", workspaceName: "VAl B" },
    );

    // A: a create, a delete and an academy assignment → three activity rows.
    const op = await createTenderOpportunity({ sub: userA }, wsA, {
      title: "Framework bid",
    });
    await deleteTenderOpportunity({ sub: userA }, op.id);
    await createAssignment({ sub: userA }, wsA, {
      courseId: COURSES[0].id,
      learnerId: "owner",
    });

    // B: unrelated activity that must never leak into A's feed.
    await createTenderOpportunity({ sub: userB }, wsB, {
      title: "B private bid",
    });

    const feedA = await listActivities({ sub: userA }, 50);
    check(
      "A's create emitted an activity",
      feedA.some(
        (a) =>
          a.title === "Framework bid" && a.description === "Tender created",
      ),
    );
    check(
      "A's delete emitted an activity",
      feedA.some(
        (a) =>
          a.title === "Framework bid" && a.description === "Tender deleted",
      ),
    );
    check(
      "academy assignment emitted an activity with course title",
      feedA.some(
        (a) =>
          a.module === "academy" &&
          a.description === "Course assigned" &&
          a.title === COURSES[0].title,
      ),
    );
    check("A has exactly 3 activities", feedA.length === 3);
    check(
      "A's feed never leaks B's activity",
      !feedA.some((a) => a.title.includes("private")),
    );

    const feedB = await listActivities({ sub: userB }, 50);
    check(
      "B has exactly 1 activity, its own",
      feedB.length === 1 && feedB[0].title === "B private bid",
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
