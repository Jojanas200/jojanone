/**
 * Verifies Jova persistent conversations: asking creates a conversation, a
 * follow-up appends to the same conversation, listing is workspace-scoped and
 * recency-ordered, reading returns the full turn history, deleting cascades to
 * the messages, and no tenant can list or delete another tenant's conversation.
 *
 * Uses the deterministic provider so the flow never touches the network.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-jova-conversations.ts
 */
process.env.JOVA_EMBEDDINGS = "off"; // skip semantic memory - keep it fast/offline
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  ask,
  listConversations,
  listConversationMessages,
  deleteConversation,
} from "../src/server/ai/chat";
import { providerFor } from "../src/server/ai/provider";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const det = providerFor("deterministic");

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
    userA = await createUser(`vjc-a-${stamp}@example.test`);
    userB = await createUser(`vjc-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VJc A", workspaceName: "VJc A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VJc B", workspaceName: "VJc B" },
    );

    // Ask -> creates a conversation.
    const r1 = await ask(
      { sub: userA },
      wsA,
      { question: "What should I focus on first?" },
      { provider: det },
    );
    check("asking returns a conversation id", !!r1.conversationId);
    const c1 = r1.conversationId;

    // Follow-up in the same conversation appends, does not fork.
    const r2 = await ask(
      { sub: userA },
      wsA,
      { question: "And after that?", conversationId: c1 },
      { provider: det },
    );
    check("follow-up stays in the same conversation", r2.conversationId === c1);

    // A second question with no conversationId starts a new one.
    const r3 = await ask(
      { sub: userA },
      wsA,
      { question: "Do I have anything overdue?" },
      { provider: det },
    );
    const c2 = r3.conversationId;
    check("a fresh question starts a new conversation", c2 !== c1);

    // Listing is scoped to A and ordered most-recently-updated first.
    const listA = await listConversations({ sub: userA });
    check("A lists exactly two conversations", listA.length === 2);
    check(
      "most-recently-updated conversation is first",
      listA[0].id === c2 && listA[1].id === c1,
    );
    check(
      "conversation title is seeded from the first question",
      listA[1].title.startsWith("What should I focus on"),
    );

    // Reading returns the full turn history (user + jova per exchange).
    const msgs = await listConversationMessages({ sub: userA }, c1);
    check("first conversation has 4 messages (2 exchanges)", msgs.length === 4);
    check(
      "turns alternate user then jova",
      msgs[0].sender === "user" &&
        msgs[1].sender === "jova" &&
        msgs[2].sender === "user" &&
        msgs[3].sender === "jova",
    );

    // Delete cascades to messages.
    const del = await deleteConversation({ sub: userA }, c2);
    check("deleting a conversation reports success", del === true);
    const afterDel = await listConversations({ sub: userA });
    check("deleted conversation is gone from the list", afterDel.length === 1);
    const c2Msgs = await listConversationMessages({ sub: userA }, c2);
    check("deleted conversation's messages cascade away", c2Msgs.length === 0);

    // Cross-tenant isolation.
    const listB = await listConversations({ sub: userB });
    check("B does not see A's conversations", listB.length === 0);
    const bReadsA = await listConversationMessages({ sub: userB }, c1);
    check("B cannot read A's conversation messages", bReadsA.length === 0);
    const bDeletesA = await deleteConversation({ sub: userB }, c1);
    check("B cannot delete A's conversation", bDeletesA === false);
    const stillThere = await listConversations({ sub: userA });
    check(
      "A's conversation survives B's delete attempt",
      stillThere.length === 1 && stillThere[0].id === c1,
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
