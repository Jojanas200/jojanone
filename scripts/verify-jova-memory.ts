/**
 * End-to-end verification of Jova memory (pgvector) against the REAL Supabase
 * project: remember → semantic recall + ranking → RLS isolation → baseline sync
 * from onboarding → delete. Uses a DETERMINISTIC stub embedder (hashed
 * bag-of-words) so the vector search and RLS are exercised without downloading
 * a model. The production path uses the real Transformers.js embedder.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-jova-memory.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  deleteWorkspaceMemories,
  listMemories,
  recall,
  remember,
  syncWorkspaceMemory,
} from "../src/server/services/jova-memory";
import { saveOnboarding } from "../src/server/services/onboarding";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { EMBED_DIMS, type Embedder } from "../src/server/ai/embedder";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

// Deterministic hashed bag-of-words embedder → similar text, similar vectors.
function embedText(text: string): number[] {
  const v = new Array(EMBED_DIMS).fill(0);
  for (const tok of text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[(h >>> 0) % EMBED_DIMS] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
const stub: Embedder = {
  id: "stub",
  dims: EMBED_DIMS,
  async isAvailable() {
    return true;
  },
  async embed(texts) {
    return texts.map(embedText);
  },
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
    userA = await createUser(`vmem-a-${stamp}@example.test`);
    userB = await createUser(`vmem-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VMem A", workspaceName: "VMem A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VMem B", workspaceName: "VMem B" },
    );
    const A = { sub: userA };
    const B = { sub: userB };

    // --- remember + recall + ranking ---------------------------------------
    await remember(
      A,
      wsA,
      {
        content:
          "The company processes personal data and is registered for VAT with HMRC",
      },
      stub,
    );
    await remember(
      A,
      wsA,
      {
        content:
          "Employers liability insurance cover is currently missing and must be arranged",
      },
      stub,
    );
    await remember(
      A,
      wsA,
      { content: "The business trades internationally and sells software" },
      stub,
    );
    await remember(
      B,
      wsB,
      { content: "Bravo Ltd is a dormant holding company with no employees" },
      stub,
    );

    const dpHit = await recall(A, "do we handle personal data and pay VAT?", {
      embedder: stub,
      k: 3,
      workspaceId: wsA,
    });
    check(
      "recall ranks the personal-data / VAT memory first",
      dpHit.length > 0 && dpHit[0].content.includes("personal data"),
    );

    const insHit = await recall(A, "insurance cover for our staff", {
      embedder: stub,
      k: 3,
      workspaceId: wsA,
    });
    check(
      "recall ranks the insurance-gap memory first for an insurance query",
      insHit.length > 0 && insHit[0].content.includes("insurance"),
    );
    check(
      "recall returns a similarity score in [0,1]",
      dpHit[0].similarity > 0 && dpHit[0].similarity <= 1.0001,
    );

    // --- RLS isolation ------------------------------------------------------
    const bRecall = await recall(B, "personal data VAT HMRC", {
      embedder: stub,
      k: 5,
      workspaceId: wsB,
    });
    check(
      "B never recalls A's memories",
      bRecall.every((m) => !m.content.includes("personal data")),
    );
    const bCrossWs = await recall(B, "personal data VAT HMRC", {
      embedder: stub,
      k: 5,
      workspaceId: wsA,
    });
    check(
      "B cannot recall by pointing at A's workspace id (RLS)",
      bCrossWs.length === 0,
    );

    check("A lists its 3 memories", (await listMemories(A)).length === 3);
    check("B lists its 1 memory", (await listMemories(B)).length === 1);

    // --- baseline sync from onboarding -------------------------------------
    await saveOnboarding(A, wsA, {
      "company.industry": "technology",
      "ops.processes_personal_data": "yes",
      "ops.employs_staff": true,
    });
    const synced = await syncWorkspaceMemory(A, wsA, stub);
    check("sync builds baseline memory docs", synced > 0);
    const industryHit = await recall(A, "what industry sector are we in", {
      embedder: stub,
      k: 5,
      workspaceId: wsA,
    });
    check(
      "recall surfaces the synced industry fact",
      industryHit.some((m) => m.content.includes("Technology")),
    );

    // --- delete -------------------------------------------------------------
    await deleteWorkspaceMemories(A, wsA, ["fact"]);
    const afterDelete = await listMemories(A);
    check(
      "delete removes only the targeted kind (facts gone, synced kept)",
      afterDelete.every((m) => m.kind !== "fact") && afterDelete.length > 0,
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
