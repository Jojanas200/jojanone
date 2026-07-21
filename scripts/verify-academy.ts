/**
 * End-to-end verification of Academy (learner assignments over the code course
 * catalogue) against the REAL Supabase project: assign → list → enrich →
 * status/complete-stamp → isolation → delete → cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-academy.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createAssignment,
  deleteAssignment,
  hasAssignment,
  listAssignments,
  updateAssignment,
} from "../src/server/services/academy";
import { COURSES } from "../src/data/academy-catalog";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const COURSE_ID = COURSES[0].id;

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
    userA = await createUser(`vac-a-${stamp}@example.test`);
    userB = await createUser(`vac-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VAc A", workspaceName: "VAc A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VAc B", workspaceName: "VAc B" },
    );

    const asg = await createAssignment({ sub: userA }, wsA, {
      courseId: COURSE_ID,
      learnerId: "owner",
      legallyRequired: true,
    });
    check(
      "assignment created + enriched with course title",
      !!asg.courseTitle && asg.courseTitle !== COURSE_ID,
    );
    check("legally-required flag persisted", asg.legallyRequired === true);

    await createAssignment({ sub: userB }, wsB, {
      courseId: COURSE_ID,
      learnerId: "owner",
    });

    const listA = await listAssignments({ sub: userA });
    check(
      "A sees only its assignment",
      listA.length === 1 && listA[0].id === asg.id,
    );

    check(
      "hasAssignment finds A's course",
      await hasAssignment({ sub: userA }, COURSE_ID),
    );

    const done = await updateAssignment({ sub: userA }, asg.id, {
      status: "completed",
    });
    check(
      "marking complete stamps completedAt",
      done?.status === "completed" && done?.completedAt !== null,
    );

    const reopened = await updateAssignment({ sub: userA }, asg.id, {
      status: "in_progress",
    });
    check("reopening clears completedAt", reopened?.completedAt === null);

    // Cross-tenant: B cannot touch A's assignment (row hidden by RLS).
    const hijack = await updateAssignment({ sub: userB }, asg.id, {
      status: "completed",
    });
    check("B cannot update A's assignment", hijack === null);
    check(
      "B cannot delete A's assignment",
      (await deleteAssignment({ sub: userB }, asg.id)) === false,
    );

    check(
      "A can remove own assignment",
      (await deleteAssignment({ sub: userA }, asg.id)) === true,
    );
    check(
      "A's list is empty after removal",
      (await listAssignments({ sub: userA })).length === 0,
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
