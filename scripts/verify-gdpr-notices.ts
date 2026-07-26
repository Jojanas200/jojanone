/**
 * Verifies GDPR privacy notices (register CRUD) and the readiness assessment
 * (checklist scoring + single-current upsert), with strict tenant isolation.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-gdpr-notices.ts
 */
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  createPrivacyNotice,
  deletePrivacyNotice,
  getGdprAssessment,
  listPrivacyNotices,
  saveGdprAssessment,
  updatePrivacyNotice,
} from "../src/server/services/gdpr-registers";

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
    userA = await createUser(`vgn-a-${stamp}@example.test`);
    userB = await createUser(`vgn-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VGn A", workspaceName: "VGn A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VGn B", workspaceName: "VGn B" },
    );

    // --- Privacy notices ---
    const notice = await createPrivacyNotice({ sub: userA }, wsA, {
      version: "1.0",
      status: "draft",
      organisation: "Acme Ltd",
      lawfulBases: ["consent", "contract"],
    });
    check("notice created draft", notice.status === "draft");
    check("lawful bases stored as array", notice.lawfulBases.length === 2);
    const pub = await updatePrivacyNotice({ sub: userA }, notice.id, {
      status: "published",
    });
    check("notice can be published", pub?.status === "published");
    check(
      "B sees none of A's notices (RLS)",
      (await listPrivacyNotices({ sub: userB })).length === 0,
    );
    check(
      "A can delete its notice",
      (await deletePrivacyNotice({ sub: userA }, notice.id)) === true,
    );

    // --- Assessment (checklist scoring + single-current upsert) ---
    const a1 = await saveGdprAssessment({ sub: userA }, wsA, {
      ropa: "yes",
      purposes: "yes",
      lawful_basis: "yes",
      special_category: "no",
      privacy_notice: "yes",
      dsar_process: "yes",
      breach_process: "unsure",
      retention: "no",
      processors: "no",
      international_transfers: "unsure",
      security: "yes",
      dpia_process: "no",
      childrens_data: "unsure",
      training: "no",
      accountability: "no",
    });
    check(
      "only 'yes' answers score (6/15 = 40)",
      a1.score === 40 && a1.status === "completed",
    );
    check("gaps list every non-yes item", a1.gaps.length === 9);
    check(
      "an 'unsure' answer still counts as a gap",
      a1.gaps.includes("No 72-hour breach response plan"),
    );
    const recs = a1.recommendations as Array<{
      label: string;
      priority: string;
    }>;
    check(
      "recommendations are generated for each gap",
      recs.length === 9 && recs.every((r) => !!r.label),
    );
    check(
      "recommendations carry a priority (incl. a high)",
      recs.every((r) => r.priority === "high" || r.priority === "medium") &&
        recs.some((r) => r.priority === "high"),
    );
    // Saving again updates the same record (single current), not a new row.
    const a2 = await saveGdprAssessment({ sub: userA }, wsA, {
      ropa: "yes",
      purposes: "yes",
      lawful_basis: "yes",
      special_category: "yes",
      privacy_notice: "yes",
      dsar_process: "yes",
      breach_process: "yes",
      retention: "yes",
      processors: "yes",
      international_transfers: "yes",
      security: "yes",
      dpia_process: "yes",
      childrens_data: "yes",
      training: "yes",
      accountability: "yes",
    });
    check("re-saving updates the same record", a2.id === a1.id);
    check(
      "full checklist scores 100 with no gaps or recommendations",
      a2.score === 100 &&
        a2.gaps.length === 0 &&
        (a2.recommendations as unknown[]).length === 0,
    );

    const got = await getGdprAssessment({ sub: userA });
    check("getGdprAssessment returns the current record", got?.id === a1.id);
    check(
      "B has no assessment (RLS)",
      (await getGdprAssessment({ sub: userB })) === null,
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
