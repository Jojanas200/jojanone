/**
 * End-to-end verification of the Growth pair (Investor Ready + Tender Ready)
 * against the REAL Supabase project: create → isolation → status → cross-tenant
 * block → delete → cleanup, for both registers.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-growth.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  createDueDiligenceItem,
  deleteDueDiligenceItem,
  listDueDiligenceItems,
  updateDueDiligenceItem,
} from "../src/server/services/investor";
import {
  createTenderOpportunity,
  deleteTenderOpportunity,
  listTenderOpportunities,
  updateTenderOpportunity,
} from "../src/server/services/tender";
import { provisionWorkspace } from "../src/server/services/provisioning";

import { createDueDiligenceItemSchema } from "../src/shared/schemas/investor";

import { createTenderOpportunitySchema } from "../src/shared/schemas/tender";

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
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";

  try {
    userA = await createUser(`vgr-a-${stamp}@example.test`);
    userB = await createUser(`vgr-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VGr A", workspaceName: "VGr A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VGr B", workspaceName: "VGr B" },
    );

    // --- Investor Ready (due-diligence items) --------------------------------
    const dd = await createDueDiligenceItem({ sub: userA }, wsA, {
      title: "Cap table",
      category: "corporate",
      required: true,
      status: "missing",
      priority: "high",
    });
    check(
      "DD item created for A",
      dd?.title === "Cap table" && dd.status === "missing",
    );
    await createDueDiligenceItem(
      { sub: userB },
      wsB,
      createDueDiligenceItemSchema.parse({
        title: "B financials",
        category: "financial",
      }),
    );
    const ddA = await listDueDiligenceItems({ sub: userA });
    check("A sees only its DD item", ddA.length === 1 && ddA[0].id === dd.id);
    const ddReady = await updateDueDiligenceItem({ sub: userA }, dd.id, {
      status: "ready",
    });
    check("A can mark DD item ready", ddReady?.status === "ready");
    let ddBlocked = false;
    try {
      await createDueDiligenceItem(
        { sub: userA },
        wsB,
        createDueDiligenceItemSchema.parse({
          title: "hack",
          category: "legal",
        }),
      );
    } catch {
      ddBlocked = true;
    }
    check("A cannot create DD item in B (RLS)", ddBlocked);
    check(
      "A can delete own DD item",
      (await deleteDueDiligenceItem({ sub: userA }, dd.id)) === true,
    );

    // --- Tender Ready (opportunities) ----------------------------------------
    const op = await createTenderOpportunity({ sub: userA }, wsA, {
      title: "Grounds maintenance framework",
      authority: "Borough Council",
      contractValue: 12_000_000,
      currency: "GBP",
      submissionDeadline: "2026-10-31",
      procedureType: "framework",
      status: "identified",
    });
    check(
      "opportunity created for A",
      op?.title === "Grounds maintenance framework" &&
        op.contractValue === 12_000_000,
    );
    await createTenderOpportunity(
      { sub: userB },
      wsB,
      createTenderOpportunitySchema.parse({
        title: "B cleaning contract",
      }),
    );
    const opA = await listTenderOpportunities({ sub: userA });
    check(
      "A sees only its opportunity",
      opA.length === 1 && opA[0].id === op.id,
    );
    const opBid = await updateTenderOpportunity({ sub: userA }, op.id, {
      status: "bid",
    });
    check("A can set bid status", opBid?.status === "bid");
    let opBlocked = false;
    try {
      await createTenderOpportunity(
        { sub: userA },
        wsB,
        createTenderOpportunitySchema.parse({ title: "hack" }),
      );
    } catch {
      opBlocked = true;
    }
    check("A cannot create opportunity in B (RLS)", opBlocked);
    const opHijack = await updateTenderOpportunity({ sub: userB }, op.id, {
      title: "hijacked",
    });
    check("B cannot update A's opportunity (row hidden)", opHijack === null);
    check(
      "A can delete own opportunity",
      (await deleteTenderOpportunity({ sub: userA }, op.id)) === true,
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
