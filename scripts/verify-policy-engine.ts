/**
 * End-to-end verification of the universal Policy Generation Engine against
 * the REAL Supabase project: deterministic draft has no placeholders ->
 * Jova Policy Check (universal + type-specific, criticals vs warnings) ->
 * adoption blocked while critical -> adoption finalises wording, stamps
 * version/effective date, snapshots and feeds Jova memory -> watermarked
 * draft vs clean final PDF/DOCX exports -> cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-policy-engine.ts
 */
import { inflateSync } from "node:zlib";
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  jovaMemories,
  organisations,
  policyVersions,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  adoptPolicy,
  checkPolicyById,
  draftPolicy,
  updatePolicy,
} from "../src/server/services/policies";
import {
  renderPolicyDocx,
  renderPolicyPdf,
} from "../src/server/services/policy-export";
import { findPlaceholders, runPolicyCheck } from "../src/shared/policies/check";
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

// Decode a pdf-lib PDF's Flate streams and return the hex-uppercased text.
function decodePdf(pdf: Uint8Array): string {
  const buf = Buffer.from(pdf);
  let decoded = "";
  let at = 0;
  for (;;) {
    const s0 = buf.indexOf("stream", at);
    if (s0 === -1) break;
    const dataStart = buf[s0 + 6] === 0x0d ? s0 + 8 : s0 + 7;
    const s1 = buf.indexOf("endstream", dataStart);
    if (s1 === -1) break;
    try {
      decoded += inflateSync(buf.subarray(dataStart, s1)).toString("latin1");
    } catch {
      decoded += buf.toString("latin1", dataStart, s1);
    }
    at = s1 + 9;
  }
  return decoded.toUpperCase();
}
const hex = (t: string) =>
  t
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

async function main() {
  const stamp = Date.now();
  let userA = "";
  let wsA = "";

  try {
    userA = await createUser(`vpe-a-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VPE A", workspaceName: "VPE A" },
    );
    const claims = { sub: userA };

    // --- Draft: neutral wording, no placeholders -----------------------------
    const draft = await draftPolicy(
      claims,
      wsA,
      {
        policyName: "Data Protection Policy",
        templateKey: "tpl_data_protection",
        answers: {},
      },
      det,
    );
    check(
      "deterministic draft contains no bracketed placeholders",
      findPlaceholders(draft.content ?? "").length === 0,
    );
    check("draft starts at v0.1 as a draft", draft.status === "draft");

    // --- Jova Policy Check ---------------------------------------------------
    const res1 = await checkPolicyById(claims, draft.id);
    check(
      "check runs with type-specific data-protection requirements",
      !!res1 && res1.check.items.some((i) => i.key === "type_lawful_basis"),
    );
    check(
      "missing owner surfaces as an issue, not a pass",
      !!res1 &&
        res1.check.items.some((i) => i.key === "owner" && i.status !== "pass"),
    );

    // Placeholders + advice inside wording are critical and block adoption.
    await updatePolicy(claims, draft.id, {
      content: `${draft.content}\n\n[Business owner] must sign this.\nJova recommends you appoint a DPO.`,
    });
    const res2 = await checkPolicyById(claims, draft.id);
    check(
      "placeholders and in-document advice are critical",
      !!res2 &&
        res2.check.items.some(
          (i) => i.key === "placeholders" && i.status === "critical",
        ) &&
        res2.check.items.some(
          (i) => i.key === "advice" && i.status === "critical",
        ) &&
        !res2.check.readyForAdoption,
    );
    const blocked = await adoptPolicy(claims, draft.id);
    check(
      "adoption refused while critical issues remain",
      !!blocked && blocked.ok === false,
    );

    // Resolve: restore clean content and set an owner.
    await updatePolicy(claims, draft.id, {
      content: draft.content ?? "",
      owner: "Priya Shah",
    });
    const res3 = await checkPolicyById(claims, draft.id);
    check(
      "resolved draft is ready for adoption",
      !!res3 && res3.check.readyForAdoption,
    );

    // --- Adoption ------------------------------------------------------------
    const adopted = await adoptPolicy(claims, draft.id);
    check(
      "adoption activates the policy at v1.0 with adoption + effective dates",
      !!adopted &&
        adopted.ok === true &&
        adopted.policy.status === "active" &&
        adopted.policy.version === "1.0" &&
        adopted.policy.adoptedAt !== null &&
        adopted.policy.approvalDate !== null,
    );
    const finalContent =
      adopted && adopted.ok ? (adopted.policy.content ?? "") : "";
    check(
      "adopted wording is finalised (draft disclaimer stripped)",
      finalContent.length > 200 &&
        !finalContent.toLowerCase().includes("starting draft"),
    );
    const snapshots = await adminDb
      .select({ id: policyVersions.id, version: policyVersions.version })
      .from(policyVersions)
      .where(eq(policyVersions.policyId, draft.id));
    check(
      "immutable v1.0 snapshot recorded",
      snapshots.some((s) => s.version === "1.0"),
    );
    const memories = await adminDb
      .select({ title: jovaMemories.title })
      .from(jovaMemories)
      .where(eq(jovaMemories.refId, draft.id));
    check(
      "adoption fed into Jova memory",
      memories.some((m) => m.title?.startsWith("Policy adopted")),
    );

    // --- Exports -------------------------------------------------------------
    const exportShape = (p: typeof adopted) =>
      p && p.ok
        ? {
            policyName: p.policy.policyName,
            policyCategory: p.policy.policyCategory,
            version: p.policy.version,
            owner: p.policy.owner,
            status: p.policy.status,
            approvalDate: p.policy.approvalDate,
            reviewDate: p.policy.reviewDate,
            adoptedAt: p.policy.adoptedAt,
            content: p.policy.content,
            jovaRecommendations: p.policy.jovaRecommendations ?? [],
          }
        : null;
    const finalShape = exportShape(adopted)!;
    const draftShape = {
      ...finalShape,
      status: "draft",
      jovaRecommendations: ["Confirm whether a DPO is required."],
    };

    const draftPdf = decodePdf(await renderPolicyPdf(draftShape, "VPE A Ltd"));
    check(
      "draft PDF is watermarked and carries the Jova appendix",
      draftPdf.includes(hex("DRAFT - REVIEW BEFORE USE")) &&
        draftPdf.includes(
          hex("JOVA RECOMMENDATIONS (not part of this policy)"),
        ),
    );
    const finalPdf = decodePdf(await renderPolicyPdf(finalShape, "VPE A Ltd"));
    check(
      "final PDF is clean with document control",
      finalPdf.includes(hex("Active (adopted)")) &&
        finalPdf.includes(hex("Document control")) &&
        finalPdf.includes(hex("Priya Shah")) &&
        !finalPdf.includes(hex("DRAFT - REVIEW BEFORE USE")) &&
        !finalPdf.includes(hex("JOVA RECOMMENDATIONS")),
    );
    const docx = await renderPolicyDocx(finalShape, "VPE A Ltd");
    check(
      "DOCX renders (zip magic bytes, sensible size)",
      docx[0] === 0x50 && docx[1] === 0x4b && docx.length > 2_000,
    );

    // --- Universal engine works standalone ----------------------------------
    const bare = runPolicyCheck("Too short.", {});
    check(
      "bare content fails purpose/scope as critical",
      bare.items.some((i) => i.key === "purpose" && i.status === "critical") &&
        !bare.readyForAdoption,
    );
  } finally {
    console.log("Cleanup…");
    try {
      const ids = [wsA].filter(Boolean);
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
