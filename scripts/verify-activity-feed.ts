/**
 * Verifies the Timeline activity feed: getActivityFeed returns the workspace's
 * recorded activities newest-first, resolves the acting user to an email,
 * reflects completion status changes, and never leaks another tenant's trail.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-activity-feed.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { getActivityFeed } from "../src/server/services/timeline";
import { createRisk } from "../src/server/services/risk";
import {
  createObligation,
  setObligationStatus,
} from "../src/server/services/compliance";

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
  const emailA = `vaf-a-${stamp}@example.test`;
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(emailA);
    userB = await createUser(`vaf-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VAf A", workspaceName: "VAf A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VAf B", workspaceName: "VAf B" },
    );

    // A fresh workspace has no activity yet.
    const empty = await getActivityFeed({ sub: userA });
    check("fresh workspace has an empty feed", empty.length === 0);

    // Seed two activities; each domain write records one.
    await createRisk({ sub: userA }, wsA, {
      riskTitle: "Supplier concentration",
      riskCategory: "operational",
      likelihood: 3,
      impact: 3,
      residualLikelihood: 2,
      residualImpact: 2,
    });
    const ob = await createObligation({ sub: userA }, wsA, {
      title: "VAT return Q1",
      category: "vat",
      status: "action_required",
    });

    const feed1 = await getActivityFeed({ sub: userA });
    check("both writes are recorded in the feed", feed1.length === 2);
    check(
      "feed is newest-first (obligation created after risk)",
      feed1[0].title === "VAT return Q1",
    );
    check(
      "each item carries module + type + status",
      feed1.every((f) => f.module && f.activityType && f.status),
    );
    check(
      "the acting user is resolved to their email",
      feed1.every((f) => f.actorEmail === emailA),
    );
    check(
      "createdAt is an ISO string",
      typeof feed1[0].createdAt === "string" &&
        !Number.isNaN(Date.parse(feed1[0].createdAt)),
    );

    // Completing an obligation records a completed activity.
    await setObligationStatus({ sub: userA }, ob.id, "completed");
    const feed2 = await getActivityFeed({ sub: userA });
    check(
      "completing records a new 'completed' activity",
      feed2.some((f) => f.status === "completed" && f.completedAt !== null),
    );
    check("feed now has three items", feed2.length === 3);

    // Cross-tenant isolation.
    const feedB = await getActivityFeed({ sub: userB });
    check("B's feed does not see A's activity", feedB.length === 0);
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
