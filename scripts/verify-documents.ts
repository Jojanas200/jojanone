/**
 * End-to-end verification of document upload against the REAL Supabase project:
 * evidence-item metadata layer (record/list/signed-key/delete) with RLS, PLUS a
 * real Storage round-trip that proves object RLS (path = workspace_id/…) blocks
 * cross-tenant writes. Cleans up users, workspaces and any stored objects.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-documents.ts
 */
import { inArray } from "drizzle-orm";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import {
  deleteDocument,
  getCurrentLogo,
  getDocumentObjectKey,
  listDocuments,
  recordDocument,
} from "../src/server/services/documents";
import { documentMetaSchema } from "../src/shared/schemas/documents";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = "Test-Passw0rd!";

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
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`createUser: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; user?: { id: string } };
  const id = data.id ?? data.user?.id;
  if (!id) throw new Error("createUser: no id");
  return id;
}
const deleteUser = (id: string) =>
  adminFetch(`/users/${id}`, { method: "DELETE" });

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("signIn: no access_token");
  return data.access_token;
}

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";
  const emailA = `vdoc-a-${stamp}@example.test`;
  const emailB = `vdoc-b-${stamp}@example.test`;
  const admin = createSbClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  let ownKey = "";

  try {
    userA = await createUser(emailA);
    userB = await createUser(emailB);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VDoc A", workspaceName: "VDoc A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VDoc B", workspaceName: "VDoc B" },
    );
    const A = { sub: userA };
    const B = { sub: userB };

    // --- metadata layer -----------------------------------------------------
    const meta = documentMetaSchema.parse({
      title: "Certificate of incorporation",
      category: "Incorporation documents",
      accessLevel: "restricted",
    });
    const doc = await recordDocument(A, wsA, meta, {
      objectKey: `${wsA}/onboarding/fake_${stamp}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1234,
      originalName: "incorp.pdf",
    });
    check(
      "document recorded for A",
      doc?.title === "Certificate of incorporation",
    );
    check("access level stored", doc.accessLevel === "restricted");

    check(
      "A lists own document (onboarding filter)",
      (await listDocuments(A, "onboarding")).some((d) => d.id === doc.id),
    );
    check(
      "B cannot see A's document (RLS)",
      (await listDocuments(B)).length === 0,
    );
    check(
      "A can resolve object key for signing",
      (await getDocumentObjectKey(A, doc.id)) === doc.objectKey,
    );
    check(
      "B cannot resolve A's object key (RLS)",
      (await getDocumentObjectKey(B, doc.id)) === null,
    );
    check(
      "B cannot delete A's document (RLS)",
      (await deleteDocument(B, doc.id)) === null,
    );
    check(
      "A deletes own document",
      (await deleteDocument(A, doc.id)) === doc.objectKey,
    );
    check("document no longer listed", (await listDocuments(A)).length === 0);

    // --- current brand logo (latest 'branding' upload wins) -----------------
    const logoMeta = documentMetaSchema.parse({
      title: "logo.png",
      category: "Brand logo",
      sourceModule: "branding",
    });
    await recordDocument(A, wsA, logoMeta, {
      objectKey: `${wsA}/branding/old_${stamp}.png`,
      mimeType: "image/png",
      sizeBytes: 10,
      originalName: "old.png",
    });
    const newer = await recordDocument(A, wsA, logoMeta, {
      objectKey: `${wsA}/branding/new_${stamp}.png`,
      mimeType: "image/png",
      sizeBytes: 20,
      originalName: "new.png",
    });
    check(
      "current logo resolves to the most recent branding upload",
      (await getCurrentLogo(A))?.id === newer.id,
    );
    check("B cannot read A's logo (RLS)", (await getCurrentLogo(B)) === null);

    // --- real Storage object RLS -------------------------------------------
    const tokenA = await signIn(emailA);
    const sbA = createSbClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${tokenA}` } },
    });
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic
    ownKey = `${wsA}/onboarding/vdoc_${stamp}.png`;

    const up1 = await sbA.storage
      .from("evidence")
      .upload(ownKey, bytes, { contentType: "image/png" });
    check("user can upload to own workspace path", !up1.error);

    const signed = await sbA.storage
      .from("evidence")
      .createSignedUrl(ownKey, 60);
    check("signed download URL is issued", !!signed.data?.signedUrl);

    const foreignKey = `${wsB}/onboarding/hack_${stamp}.png`;
    const up2 = await sbA.storage
      .from("evidence")
      .upload(foreignKey, bytes, { contentType: "image/png" });
    check(
      "user CANNOT upload into another workspace's path (object RLS)",
      !!up2.error,
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (ownKey) await admin.storage.from("evidence").remove([ownKey]);
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
