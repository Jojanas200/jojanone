/**
 * Verifies policy version history: publishing a policy snapshots an immutable
 * version, re-publishing a live policy does NOT duplicate, archive-then-publish
 * captures a new version, and versions are tenant isolated (RLS).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-policy-versions.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { updateBusinessProfile } from "../src/server/services/settings";
import {
  draftPolicy,
  listPolicyVersions,
  setPolicyStatus,
} from "../src/server/services/policies";
import { providerFor } from "../src/server/ai/provider";
import { draftPolicySchema } from "../src/shared/schemas/policies";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const det = { provider: providerFor("deterministic") };

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
    userA = await createUser(`vpv-a-${stamp}@example.test`);
    userB = await createUser(`vpv-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VPv A", workspaceName: "VPv A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VPv B", workspaceName: "VPv B" },
    );
    await updateBusinessProfile({ sub: userA }, wsA, {
      businessName: "Versioned Ltd",
    });

    const policy = await draftPolicy(
      { sub: userA },
      wsA,
      draftPolicySchema.parse({
        policyName: "Data Protection Policy",
        policyCategory: "Data protection",
        answers: {},
      }),
      det,
    );
    check(
      "a fresh draft has no versions",
      (await listPolicyVersions({ sub: userA }, policy.id)).length === 0,
    );

    // Publish -> snapshot a version.
    await setPolicyStatus({ sub: userA }, policy.id, "active");
    const v1 = await listPolicyVersions({ sub: userA }, policy.id);
    check("publishing captures one version", v1.length === 1);
    check(
      "the version snapshots the document content",
      !!v1[0].content && v1[0].content.includes("Versioned Ltd"),
    );

    // Re-publishing a live policy must NOT duplicate.
    await setPolicyStatus({ sub: userA }, policy.id, "active");
    check(
      "re-publishing a live policy does not duplicate",
      (await listPolicyVersions({ sub: userA }, policy.id)).length === 1,
    );

    // Archive then publish again -> a second version.
    await setPolicyStatus({ sub: userA }, policy.id, "archived");
    await setPolicyStatus({ sub: userA }, policy.id, "active");
    const v2 = await listPolicyVersions({ sub: userA }, policy.id);
    check("archive then re-publish captures a second version", v2.length === 2);
    check(
      "versions are newest-first",
      new Date(v2[0].createdAt).getTime() >=
        new Date(v2[1].createdAt).getTime(),
    );

    // Cross-tenant isolation.
    check(
      "B cannot see A's policy versions (RLS)",
      (await listPolicyVersions({ sub: userB }, policy.id)).length === 0,
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
