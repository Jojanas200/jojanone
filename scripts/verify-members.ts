/**
 * Verifies member management (co-owner + ownership transfer):
 *  - owner can promote a member to owner_admin (co-owner) and demote back;
 *  - changing a role clears an adviser's module scope;
 *  - the last owner is protected; self role-change / self-removal are refused;
 *  - ownership transfer promotes the target and steps the caller down atomically;
 *  - non-owners are blocked by RLS; auth emails resolve for the members list.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-members.ts
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  memberships,
  organisations,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { getWorkspaceRole } from "../src/server/services/workspaces";
import {
  getUserEmails,
  removeMember,
  transferOwnership,
  updateMemberRole,
  updateMemberScope,
} from "../src/server/services/members";

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

const roleOf = (workspaceId: string, userId: string) =>
  adminDb
    .select({ role: memberships.role, scoped: memberships.scopedModules })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

const membershipId = (workspaceId: string, userId: string) =>
  roleOf(workspaceId, userId).then(() =>
    adminDb
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, userId),
        ),
      )
      .limit(1)
      .then((r) => r[0]?.id ?? ""),
  );

async function main() {
  const stamp = Date.now();
  const emailA = `mem-a-${stamp}@example.test`;
  const emailB = `mem-b-${stamp}@example.test`;
  const emailC = `mem-c-${stamp}@example.test`;
  let userA = "";
  let userB = "";
  let userC = "";
  let wsA = "";

  try {
    userA = await createUser(emailA);
    userB = await createUser(emailB);
    userC = await createUser(emailC);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Members Co", workspaceName: "Members Co" },
    );
    // Seed two members directly (bypasses seat/invite flow - not under test here).
    await adminDb.insert(memberships).values([
      { workspaceId: wsA, userId: userB, role: "team_member" },
      { workspaceId: wsA, userId: userC, role: "team_member" },
    ]);

    const mA = await membershipId(wsA, userA);
    const mB = await membershipId(wsA, userB);
    const mC = await membershipId(wsA, userC);

    // --- Emails resolve for the members list --------------------------------
    const emails = await getUserEmails([userA, userB, userC]);
    check(
      "auth emails resolve for members",
      emails[userA] === emailA &&
        emails[userB] === emailB &&
        emails[userC] === emailC,
    );

    // --- Non-owner is blocked by RLS ----------------------------------------
    const blocked = await updateMemberRole({ sub: userB }, wsA, mC, "manager");
    check(
      "a non-owner cannot change roles (RLS denies the write)",
      blocked.ok === false &&
        (await roleOf(wsA, userC))?.role === "team_member",
    );

    // --- Self role-change refused -------------------------------------------
    const selfRole = await updateMemberRole({ sub: userA }, wsA, mA, "manager");
    check("owner cannot change their own role", selfRole.ok === false);

    // --- Promote to co-owner, then demote -----------------------------------
    const promote = await updateMemberRole(
      { sub: userA },
      wsA,
      mB,
      "owner_admin",
    );
    check(
      "owner promotes a member to co-owner",
      promote.ok === true && (await roleOf(wsA, userB))?.role === "owner_admin",
    );
    const demote = await updateMemberRole({ sub: userA }, wsA, mB, "manager");
    check(
      "owner demotes a co-owner (another owner remains)",
      demote.ok === true && (await roleOf(wsA, userB))?.role === "manager",
    );

    // --- Re-scope an existing adviser ---------------------------------------
    await updateMemberRole({ sub: userA }, wsA, mC, "adviser");
    const scoped1 = await updateMemberScope({ sub: userA }, wsA, mC, [
      "compliance",
      "risk",
      "not-a-real-module",
    ]);
    check(
      "owner re-scopes an adviser (unknown keys filtered)",
      scoped1.ok === true &&
        JSON.stringify((await roleOf(wsA, userC))?.scoped) ===
          JSON.stringify(["compliance", "risk"]),
    );
    const scoped2 = await updateMemberScope({ sub: userA }, wsA, mC, []);
    check(
      "empty scope returns an adviser to full access",
      scoped2.ok === true && (await roleOf(wsA, userC))?.scoped === null,
    );
    const scopedNonAdviser = await updateMemberScope({ sub: userA }, wsA, mB, [
      "risk",
    ]);
    check(
      "module scope cannot be set on a non-adviser",
      scopedNonAdviser.ok === false,
    );
    const scopedNonOwner = await updateMemberScope({ sub: userB }, wsA, mC, [
      "risk",
    ]);
    check(
      "a non-owner cannot re-scope an adviser (RLS denies)",
      scopedNonOwner.ok === false,
    );

    // --- Changing role clears adviser scope ---------------------------------
    await adminDb
      .update(memberships)
      .set({ role: "adviser", scopedModules: ["risk"] })
      .where(eq(memberships.id, mC));
    const clear = await updateMemberRole(
      { sub: userA },
      wsA,
      mC,
      "team_member",
    );
    const cAfter = await roleOf(wsA, userC);
    check(
      "changing an adviser's role clears their module scope",
      clear.ok === true &&
        cAfter?.role === "team_member" &&
        cAfter?.scoped === null,
    );

    // --- Self-removal refused ------------------------------------------------
    const selfRemove = await removeMember({ sub: userA }, wsA, mA);
    check("owner cannot remove themselves", selfRemove.ok === false);

    // --- Remove a member -----------------------------------------------------
    const rem = await removeMember({ sub: userA }, wsA, mC);
    check(
      "owner removes a member",
      rem.ok === true && (await roleOf(wsA, userC)) === undefined,
    );

    // --- Transfer guards -----------------------------------------------------
    const toSelf = await transferOwnership({ sub: userA }, wsA, mA);
    check("cannot transfer ownership to yourself", toSelf.ok === false);
    const notOwner = await transferOwnership({ sub: userB }, wsA, mA);
    check("a non-owner cannot transfer ownership", notOwner.ok === false);

    // --- Transfer ownership (with a chosen step-down role) ------------------
    const transfer = await transferOwnership(
      { sub: userA },
      wsA,
      mB,
      "read_only",
    );
    check("ownership transfer succeeds", transfer.ok === true);
    check(
      "target becomes owner, caller steps down to the chosen role",
      (await getWorkspaceRole({ sub: userB }, wsA)) === "owner_admin" &&
        (await getWorkspaceRole({ sub: userA }, wsA)) === "read_only",
    );
    const owners = Number(
      (
        await adminDb
          .select({ n: sql<number>`count(*)` })
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, wsA),
              eq(memberships.role, "owner_admin"),
            ),
          )
      )[0]?.n ?? 0,
    );
    check("exactly one owner remains after transfer", owners === 1);

    // --- Old owner can no longer manage -------------------------------------
    const exOwner = await updateMemberRole({ sub: userA }, wsA, mB, "manager");
    check(
      "the former owner can no longer change roles (RLS denies)",
      exOwner.ok === false &&
        (await roleOf(wsA, userB))?.role === "owner_admin",
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(eq(workspaces.id, wsA));
        await adminDb.delete(workspaces).where(eq(workspaces.id, wsA));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      for (const u of [userA, userB, userC]) if (u) await deleteUser(u);
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
