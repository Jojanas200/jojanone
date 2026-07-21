/**
 * Verifies cross-tenant user administration + GDPR erasure:
 *  - listPlatformUsers searches by email; getPlatformUser resolves memberships;
 *  - disable/enable toggles the ban; confirm marks an unconfirmed email;
 *  - a recovery link is generated; erase removes account + memberships + prefs.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-users.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  memberships,
  organisations,
  platformAuditLog,
  userPreferences,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  confirmUserEmail,
  eraseUser,
  generateRecoveryLink,
  getPlatformUser,
  listPlatformUsers,
  setUserBanned,
} from "../src/server/services/platform-users";

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
async function createUser(email: string, confirm = true): Promise<string> {
  const res = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Test-Passw0rd!",
      email_confirm: confirm,
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
  const emailA = `puser-a-${stamp}@example.test`;
  const emailB = `puser-b-${stamp}@example.test`;
  const actor = { sub: "", email: "users-verify@jojan.one" };
  let userA = "";
  let userB = "";
  let wsA = "";

  try {
    userA = await createUser(emailA, true);
    actor.sub = userA;
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "User Co", workspaceName: "User Co" },
    );

    // --- Search + detail -----------------------------------------------------
    const found = await listPlatformUsers({ search: emailA });
    check(
      "search finds the user by email",
      found.rows.some((u) => u.id === userA && u.email === emailA) &&
        found.total >= 1,
    );

    const detail = await getPlatformUser(userA);
    check(
      "detail resolves the user's memberships across tenants",
      !!detail &&
        detail.memberships.some(
          (m) => m.workspaceId === wsA && m.role === "owner_admin",
        ),
    );

    // --- Disable / enable ----------------------------------------------------
    await setUserBanned(actor, userA, true);
    check(
      "disable bans the account",
      (await getPlatformUser(userA))?.bannedUntil != null,
    );
    await setUserBanned(actor, userA, false);
    check(
      "enable lifts the ban",
      (await getPlatformUser(userA))?.bannedUntil == null,
    );

    // --- Confirm an unconfirmed email ---------------------------------------
    userB = await createUser(emailB, false);
    check(
      "new user starts unconfirmed",
      (await getPlatformUser(userB))?.confirmedAt == null,
    );
    await confirmUserEmail(actor, userB);
    check(
      "confirm marks the email confirmed",
      (await getPlatformUser(userB))?.confirmedAt != null,
    );

    // --- Recovery link -------------------------------------------------------
    const rec = await generateRecoveryLink(actor, emailA);
    check(
      "a recovery link is generated",
      rec.ok === true && typeof rec.link === "string" && rec.link.length > 0,
    );

    // --- GDPR erase ----------------------------------------------------------
    const erased = await eraseUser(actor, userB);
    check("erase reports success", erased.ok === true);
    check(
      "erased user no longer resolves",
      (await getPlatformUser(userB)) === null,
    );
    userB = ""; // already deleted

    // Audit trail for the operator actions.
    const audits = await adminDb
      .select({ action: platformAuditLog.action })
      .from(platformAuditLog)
      .where(eq(platformAuditLog.actorEmail, actor.email));
    check(
      "user actions are audited",
      ["user.disable", "user.enable", "user.confirm_email", "user.erase"].every(
        (a) => audits.some((x) => x.action === a),
      ),
    );
  } finally {
    console.log("Cleanup…");
    try {
      await adminDb
        .delete(platformAuditLog)
        .where(eq(platformAuditLog.actorEmail, actor.email));
      if (wsA) {
        await adminDb
          .delete(memberships)
          .where(eq(memberships.workspaceId, wsA));
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
      await adminDb
        .delete(userPreferences)
        .where(inArray(userPreferences.userId, [userA, userB].filter(Boolean)));
      for (const u of [userA, userB]) if (u) await deleteUser(u);
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
