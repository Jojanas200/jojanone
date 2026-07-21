/**
 * Bootstrap an OWNER account (owner_admin of a fresh workspace).
 *
 * In Jojan One there is no global super-admin; "owner" = the owner_admin role of
 * a workspace, created by provision_workspace(). This script:
 *   1. creates (or reuses) a confirmed Supabase auth user, and
 *   2. provisions their organisation + workspace + owner_admin membership
 *      (+ business profile, settings, and a trialing Starter subscription).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL in
 * the environment (they're in .env.local).
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   ./node_modules/.bin/tsx scripts/create-owner.ts <email> <password> [orgName] [workspaceName]
 *
 * Or via env:  OWNER_EMAIL=... OWNER_PASSWORD=... OWNER_ORG=... OWNER_WORKSPACE=...
 */
import { and, eq } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { memberships } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const email = (args[0] ?? process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
const password = args[1] ?? process.env.OWNER_PASSWORD ?? "";
const orgName = args[2] ?? process.env.OWNER_ORG ?? "My Business";
const workspaceName = args[3] ?? process.env.OWNER_WORKSPACE ?? orgName;

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Find an existing user id by email (scans admin user list). */
async function findUserByEmail(target: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const res = await adminFetch(`/users?page=${page}&per_page=200`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: { id: string; email?: string }[];
    };
    const users = data.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < 200) break; // last page
  }
  return null;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY)
    fail(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run: set -a; source .env.local; set +a",
    );
  if (!email || !password)
    fail(
      "Usage: tsx scripts/create-owner.ts <email> <password> [orgName] [workspaceName]\n" +
        "  (or set OWNER_EMAIL / OWNER_PASSWORD)",
    );
  if (password.length < 8) fail("Password must be at least 8 characters.");

  console.log(`\nBootstrapping owner: ${email}`);

  // 1. Create (or reuse) the auth user.
  let userId: string;
  const created = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (created.ok) {
    const data = (await created.json()) as {
      id?: string;
      user?: { id: string };
    };
    userId = (data.id ?? data.user?.id)!;
    console.log(`  ✓ auth user created (${userId})`);
  } else {
    const body = await created.text();
    const existing = await findUserByEmail(email);
    if (!existing)
      fail(
        `Could not create user and no existing user found: ${created.status} ${body}`,
      );
    userId = existing;
    console.log(`  • auth user already exists (${userId}) — reusing`);
  }

  // 2. Provision a workspace if they don't already own one.
  const existingMembership = await adminDb
    .select({ workspaceId: memberships.workspaceId, role: memberships.role })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.role, "owner_admin")),
    )
    .limit(1);

  if (existingMembership.length > 0) {
    console.log(
      `  • already owner_admin of workspace ${existingMembership[0].workspaceId} — nothing to provision`,
    );
    console.log(`\n✓ Done. Sign in at /login with ${email}\n`);
    return;
  }

  const workspaceId = await provisionWorkspace(
    { sub: userId },
    { orgName, workspaceName },
  );
  console.log(`  ✓ workspace provisioned (${workspaceId}) — role: owner_admin`);
  console.log(`\n✓ Done. Sign in at /login with ${email}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
