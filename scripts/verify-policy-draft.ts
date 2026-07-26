/**
 * Verifies Jova policy drafting: draftPolicy() produces a DRAFT policy with a
 * real document body grounded in the business profile, the body is editable via
 * updatePolicy(content), the draft is workspace-scoped, and no other tenant can
 * read or edit it. Uses the deterministic template provider so the draft is
 * offline and reproducible.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-policy-draft.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { updateBusinessProfile } from "../src/server/services/settings";
import {
  draftPolicy,
  getPolicy,
  updatePolicy,
  listPolicies,
} from "../src/server/services/policies";
import { providerFor } from "../src/server/ai/provider";

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
    userA = await createUser(`vpd-a-${stamp}@example.test`);
    userB = await createUser(`vpd-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VPd A", workspaceName: "VPd A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VPd B", workspaceName: "VPd B" },
    );

    // Ground A's profile so the draft can reference real business facts.
    await updateBusinessProfile({ sub: userA }, wsA, {
      businessName: "Northwind Care Ltd",
      industry: "Domiciliary care",
      employeeCount: 12,
    });

    // Draft from a template with guided answers (deterministic path).
    const drafted = await draftPolicy(
      { sub: userA },
      wsA,
      {
        templateKey: "tpl_data_protection",
        policyName: "Data Protection Policy",
        answers: {
          purpose:
            "To protect the personal data of our care clients and staff.",
          scope: "All employees and contractors who handle client records.",
          lawful_bases: "Legal obligation and legitimate interests.",
        },
      },
      det,
    );
    const body = drafted.content ?? "";
    check("draft is created as a draft status", drafted.status === "draft");
    check(
      "category is taken from the chosen template",
      drafted.policyName === "Data Protection Policy" &&
        drafted.policyCategory === "Data protection",
    );
    check("draft has a substantial document body", body.length > 200);
    check(
      "the typed purpose is woven into the document",
      body.includes("protect the personal data of our care clients"),
    );
    check(
      "a template-specific answer feeds its section",
      body.includes("Legal obligation and legitimate interests"),
    );
    check(
      "body is grounded in the business name",
      body.includes("Northwind Care Ltd"),
    );
    check(
      "body carries the template section structure",
      body.includes("1. Purpose") && body.includes("Review schedule"),
    );
    check(
      "review date is set from the template cadence",
      drafted.reviewDate !== null,
    );
    check(
      "acknowledgement required is taken from the template",
      drafted.acknowledgementRequired === true,
    );
    check(
      "notes record the template Jova drafted from",
      !!drafted.notes &&
        drafted.notes.includes("Data Protection Policy template"),
    );
    check("content contains no emdash", !body.includes("—"));

    // It shows up in the register and is readable back.
    const reg = await listPolicies({ sub: userA });
    check(
      "drafted policy is in the register",
      reg.some((p) => p.id === drafted.id),
    );
    const fetched = await getPolicy({ sub: userA }, drafted.id);
    check(
      "getPolicy returns the stored body",
      fetched?.content === drafted.content,
    );

    // The body is editable (review-and-adopt flow).
    const edited = await updatePolicy({ sub: userA }, drafted.id, {
      content: "Revised body after review.",
    });
    check(
      "editing the document persists",
      edited?.content === "Revised body after review.",
    );

    // Cross-tenant isolation.
    const bReads = await getPolicy({ sub: userB }, drafted.id);
    check("B cannot read A's drafted policy", bReads === null);
    const bEdits = await updatePolicy({ sub: userB }, drafted.id, {
      content: "hijacked",
    });
    check("B cannot edit A's drafted policy", bEdits === null);
    const stillMine = await getPolicy({ sub: userA }, drafted.id);
    check(
      "A's document is unchanged by B's attempt",
      stillMine?.content === "Revised body after review.",
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
