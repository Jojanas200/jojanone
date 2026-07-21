/**
 * Verifies operator support tooling:
 *  - a tenant note is added + listed (newest first), and is audited;
 *  - a broadcast writes an in-app notification to the workspace;
 *  - a metadata-only export returns account + members + record counts.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-support.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  memberships,
  notifications,
  organisations,
  platformAuditLog,
  tenantNotes,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  addTenantNote,
  broadcastNotification,
  getTenantExport,
  listTenantNotes,
} from "../src/server/services/platform-support";

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
  const emailA = `support-${stamp}@example.test`;
  const actor = { sub: "", email: "support-verify@jojan.one" };
  let userA = "";
  let wsA = "";

  try {
    userA = await createUser(emailA);
    actor.sub = userA;
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Support Co", workspaceName: "Support Co" },
    );

    // --- Notes ---------------------------------------------------------------
    await addTenantNote(actor, wsA, "First contact - onboarding help.");
    await addTenantNote(actor, wsA, "Second note.");
    const notes = await listTenantNotes(wsA);
    check(
      "notes are listed newest-first with the author",
      notes.length === 2 &&
        notes[0].body === "Second note." &&
        notes[0].authorEmail === actor.email,
    );
    const emptyNote = await addTenantNote(actor, wsA, "   ");
    check("an empty note is rejected", emptyNote.ok === false);

    // --- Broadcast -----------------------------------------------------------
    await broadcastNotification(actor, wsA, {
      title: "Action needed",
      description: "Please confirm your details.",
    });
    const notifs = await adminDb
      .select({ title: notifications.title, kind: notifications.kind })
      .from(notifications)
      .where(eq(notifications.workspaceId, wsA));
    check(
      "broadcast writes a workspace notification",
      notifs.some((n) => n.title === "Action needed" && n.kind === "priority"),
    );

    // --- Export --------------------------------------------------------------
    const exp = await getTenantExport(wsA);
    check(
      "export returns account + subscription + members",
      !!exp &&
        exp.workspace.name === "Support Co" &&
        exp.subscription?.planKey === "starter" &&
        exp.members.some((m) => m.email === emailA && m.role === "owner_admin"),
    );
    check(
      "export includes metadata-only record counts (no records)",
      !!exp &&
        typeof exp.recordCounts.contracts === "number" &&
        typeof exp.recordCounts.activities === "number",
    );

    // --- Audit ---------------------------------------------------------------
    const audits = await adminDb
      .select({ action: platformAuditLog.action })
      .from(platformAuditLog)
      .where(eq(platformAuditLog.actorEmail, actor.email));
    check(
      "note + broadcast are audited",
      audits.some((a) => a.action === "note.add") &&
        audits.some((a) => a.action === "notify.broadcast"),
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
        await adminDb
          .delete(tenantNotes)
          .where(eq(tenantNotes.workspaceId, wsA));
        await adminDb
          .delete(notifications)
          .where(eq(notifications.workspaceId, wsA));
        await adminDb
          .delete(memberships)
          .where(eq(memberships.workspaceId, wsA));
        await adminDb
          .delete(platformAuditLog)
          .where(eq(platformAuditLog.actorEmail, actor.email));
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
      if (userA) await deleteUser(userA);
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
