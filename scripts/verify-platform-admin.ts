/**
 * Verifies the platform-admin (Jojan One management) layer:
 *  - the allowlist predicate (PLATFORM_ADMIN_EMAILS) admits only listed emails;
 *  - listPlatformWorkspaces / getPlatformOverview see ACROSS tenants (adminDb);
 *  - this is genuinely elevated vs a tenant's RLS-scoped view (an owner sees
 *    only their own workspace).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-admin.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  organisations,
  platformAuditLog,
  workspaces,
} from "../src/server/db/schema";
import {
  getPlatformOverview,
  getWorkspaceOwner,
  isPlatformAdmin,
  listAuditLog,
  listPlatformWorkspaces,
  queryPlatformWorkspaces,
  logPlatformAction,
  suspendWorkspace,
  unsuspendWorkspace,
} from "../src/server/services/platform-admin";
import { listMyWorkspaces } from "../src/server/services/workspaces";
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
  const nameA = `Tenant-A-${stamp}`;
  const nameB = `Tenant-B-${stamp}`;
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";
  const savedList = process.env.PLATFORM_ADMIN_EMAILS;

  try {
    // --- Allowlist predicate -------------------------------------------------
    process.env.PLATFORM_ADMIN_EMAILS = "ops@jojan.one, boss@jojan.one";
    check("listed email is a platform admin", isPlatformAdmin("ops@jojan.one"));
    check(
      "listed email is case-insensitive",
      isPlatformAdmin("Boss@Jojan.One"),
    );
    check(
      "unlisted email is NOT a platform admin",
      !isPlatformAdmin("owner@customer.co.uk"),
    );
    check("null email is not a platform admin", !isPlatformAdmin(null));
    delete process.env.PLATFORM_ADMIN_EMAILS;
    check(
      "with no allowlist configured, nobody is a platform admin",
      !isPlatformAdmin("ops@jojan.one"),
    );
    process.env.PLATFORM_ADMIN_EMAILS = savedList ?? "";

    // --- Two separate tenants ------------------------------------------------
    userA = await createUser(`pa-a-${stamp}@example.test`);
    userB = await createUser(`pa-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: nameA, workspaceName: nameA },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: nameB, workspaceName: nameB },
    );

    // --- Cross-tenant visibility (elevated) ----------------------------------
    const all = await listPlatformWorkspaces();
    const names = new Set(all.map((w) => w.name));
    check(
      "platform view sees BOTH tenants' workspaces (cross-tenant)",
      names.has(nameA) && names.has(nameB),
    );
    const rowA = all.find((w) => w.name === nameA);
    check(
      "each row carries plan + status + seat metadata",
      rowA?.planKey === "starter" &&
        rowA?.status === "trialing" &&
        rowA?.seatsUsed === 1,
    );

    const overview = await getPlatformOverview();
    check(
      "overview counts at least our two workspaces",
      overview.workspaces >= 2,
    );
    check(
      "overview breaks down by plan and status",
      "starter" in overview.byPlan && "trialing" in overview.byStatus,
    );

    // --- Search / filter / pagination (tenant list at scale) ----------------
    const searched = await queryPlatformWorkspaces({ search: nameA });
    check(
      "search matches by workspace name",
      searched.rows.some((r) => r.name === nameA) &&
        searched.rows.every((r) => r.name.includes(nameA)),
    );
    const filtered = await queryPlatformWorkspaces({
      search: String(stamp),
      status: "trialing",
    });
    check(
      "status filter narrows to trialing subscribers",
      filtered.rows.length >= 2 &&
        filtered.rows.every((r) => r.status === "trialing"),
    );
    const paged = await queryPlatformWorkspaces({
      search: String(stamp),
      limit: 1,
    });
    check(
      "pagination returns one row but reports the full total",
      paged.rows.length === 1 && paged.total >= 2,
    );
    check(
      "seat usage is populated on the page rows",
      paged.rows[0]?.seatsUsed === 1,
    );

    // --- Contrast: a tenant owner is RLS-scoped to their own workspace only ---
    const ownerAView = await listMyWorkspaces({ sub: userA });
    check(
      "a tenant owner sees ONLY their own workspace (RLS)",
      ownerAView.length === 1 && ownerAView[0].name === nameA,
    );
    check(
      "the platform view is strictly larger than a tenant's",
      all.length > ownerAView.length,
    );

    // --- Suspend / unsuspend (audited) --------------------------------------
    const actor = { sub: userA, email: "ops@jojan.one" };
    await suspendWorkspace(actor, wsA, "non-payment");
    const susp = await adminDb
      .select({ s: workspaces.suspendedAt })
      .from(workspaces)
      .where(eq(workspaces.id, wsA));
    check("suspend sets suspended_at", susp[0]?.s != null);
    const tenantView = await listMyWorkspaces({ sub: userA });
    check(
      "the suspended flag reaches the tenant (drives the access gate)",
      tenantView[0]?.suspendedAt != null,
    );
    await unsuspendWorkspace(actor, wsA);
    const unsusp = await adminDb
      .select({ s: workspaces.suspendedAt })
      .from(workspaces)
      .where(eq(workspaces.id, wsA));
    check("unsuspend clears suspended_at", unsusp[0]?.s == null);

    // --- Impersonation target + audit ---------------------------------------
    const owner = await getWorkspaceOwner(wsA);
    check(
      "workspace owner resolved for impersonation",
      owner?.userId === userA,
    );
    await logPlatformAction(actor, "impersonate.start", {
      targetWorkspaceId: wsA,
      targetUserId: userA,
      detail: { email: "owner@example.test" },
    });

    const log = await listAuditLog(100);
    check(
      "suspend + unsuspend + impersonate are all audited with the actor",
      log.some(
        (r) =>
          r.action === "workspace.suspend" && r.actorEmail === "ops@jojan.one",
      ) &&
        log.some((r) => r.action === "workspace.unsuspend") &&
        log.some((r) => r.action === "impersonate.start"),
    );
  } finally {
    if (savedList === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = savedList;
    console.log("Cleanup…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        await adminDb
          .delete(platformAuditLog)
          .where(inArray(platformAuditLog.targetWorkspaceId, ids));
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
