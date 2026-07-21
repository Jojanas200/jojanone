/**
 * Verifies the reminder engine + in-app notifications: in-window dated items
 * generate reminders, generation is idempotent (no duplicates on re-run),
 * out-of-window items are ignored, mark-read works, and the feed is
 * tenant-scoped.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-reminders.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { createObligation } from "../src/server/services/compliance";
import { createContract } from "../src/server/services/contracts";
import { createTenderOpportunity } from "../src/server/services/tender";
import {
  generateAllReminders,
  generateReminders,
} from "../src/server/services/reminders";
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "../src/server/services/notifications";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TODAY = new Date().toISOString().slice(0, 10);
const addDays = (base: string, n: number) => {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

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
    userA = await createUser(`vrm-a-${stamp}@example.test`);
    userB = await createUser(`vrm-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VRm A", workspaceName: "VRm A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VRm B", workspaceName: "VRm B" },
    );

    // A: three in-window items + one out-of-window (45 days > 30-day horizon).
    await createObligation({ sub: userA }, wsA, {
      title: "Confirmation statement",
      category: "companies_house",
      dueDate: addDays(TODAY, 5),
    });
    await createContract({ sub: userA }, wsA, {
      contractType: "customer",
      title: "Key account MSA",
      renewalDate: addDays(TODAY, 10),
    });
    await createTenderOpportunity({ sub: userA }, wsA, {
      title: "Framework opportunity",
      submissionDeadline: addDays(TODAY, 7),
    });
    await createObligation({ sub: userA }, wsA, {
      title: "Far future filing",
      category: "tax",
      dueDate: addDays(TODAY, 45),
    });

    const created = await generateReminders(wsA, { today: TODAY });
    check("three in-window items generate reminders", created === 3);
    check(
      "unread count reflects the reminders",
      (await unreadCount({ sub: userA })) === 3,
    );

    const feed = await listNotifications({ sub: userA });
    check("feed lists the reminders", feed.length === 3);
    check(
      "out-of-window item is ignored",
      !feed.some((n) => n.title.includes("Far future")),
    );
    check(
      "reminders carry deep-links to their module",
      feed.every((n) => n.href.startsWith("/")),
    );

    // Idempotency: re-running creates nothing new.
    const rerun = await generateReminders(wsA, { today: TODAY });
    check("re-running the engine is idempotent", rerun === 0);
    check(
      "unread count unchanged after re-run",
      (await unreadCount({ sub: userA })) === 3,
    );

    // Mark read.
    check(
      "mark one read",
      (await markRead({ sub: userA }, feed[0].id)) === true,
    );
    check("unread drops to 2", (await unreadCount({ sub: userA })) === 2);
    check(
      "mark all read clears the rest",
      (await markAllRead({ sub: userA })) === 2,
    );
    check("unread is now zero", (await unreadCount({ sub: userA })) === 0);

    // Cross-tenant: B's reminders never appear in A's feed.
    await createObligation({ sub: userB }, wsB, {
      title: "B private filing",
      category: "vat",
      dueDate: addDays(TODAY, 3),
    });
    const createdB = await generateReminders(wsB, { today: TODAY });
    check("B generates its own reminder", createdB === 1);
    const feedA = await listNotifications({ sub: userA });
    check(
      "A's feed never contains B's reminder",
      !feedA.some((n) => n.title.includes("private")),
    );
    check(
      "B sees exactly its own reminder",
      (await unreadCount({ sub: userB })) === 1,
    );

    // The all-workspaces entry point runs across tenants.
    const all = await generateAllReminders({ today: TODAY });
    check(
      "generateAllReminders spans multiple workspaces",
      all.workspaces >= 2,
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
