/**
 * Verifies cross-tenant analytics aggregates (platform admin):
 *  - provisioning a workspace increments total + new-30d + plan mix + seats;
 *  - today appears in the 30-day signup trend;
 *  - seeding a conversation + message increments the Jova usage counters;
 *  - utilisation is a sane percentage.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-platform-analytics.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  conversations,
  messages,
  organisations,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { getPlatformAnalytics } from "../src/server/services/platform-analytics";

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

const planCount = (
  rows: { key: string; count: number }[],
  key: string,
): number => rows.find((r) => r.key === key)?.count ?? 0;

async function main() {
  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  let userA = "";
  let wsA = "";
  let convId = "";

  try {
    const before = await getPlatformAnalytics();

    userA = await createUser(`analytics-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Analytics Co", workspaceName: "Analytics Co" },
    );

    // Seed one conversation + message for Jova usage.
    convId = (
      await adminDb
        .insert(conversations)
        .values({ workspaceId: wsA, title: "verify", createdBy: userA })
        .returning({ id: conversations.id })
    )[0].id;
    await adminDb.insert(messages).values({
      workspaceId: wsA,
      conversationId: convId,
      sender: "user",
      content: "hello",
    });

    const after = await getPlatformAnalytics();

    check(
      "provisioning increments the workspace total",
      after.workspaces.total === before.workspaces.total + 1,
    );
    check(
      "new-30-day count includes the new workspace",
      after.workspaces.new30 >= before.workspaces.new30 + 1,
    );
    check(
      "today appears in the 30-day signup trend",
      after.signupsByDay.some((d) => d.day === today && d.count >= 1),
    );
    check(
      "plan mix counts the new starter subscription",
      planCount(after.byPlan, "starter") >=
        planCount(before.byPlan, "starter") + 1,
    );
    check(
      "seat totals grow with the new workspace",
      after.seats.allowed === before.seats.allowed + 1 &&
        after.seats.used === before.seats.used + 1,
    );
    check(
      "utilisation is a sane percentage",
      after.seats.utilizationPct >= 0 && after.seats.utilizationPct <= 100,
    );
    check(
      "Jova conversation + message counters increment",
      after.ai.conversations === before.ai.conversations + 1 &&
        after.ai.messages === before.ai.messages + 1 &&
        after.ai.messages30 === before.ai.messages30 + 1,
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (wsA) {
        await adminDb.delete(messages).where(eq(messages.workspaceId, wsA));
        await adminDb
          .delete(conversations)
          .where(eq(conversations.workspaceId, wsA));
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
