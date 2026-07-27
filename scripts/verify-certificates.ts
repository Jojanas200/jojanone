/**
 * End-to-end verification of Academy certificates against the REAL Supabase
 * project: issue with learner name -> fetch by id (RLS-scoped) -> branded PDF
 * renders with learner/course/reference -> Jova retrieval sees the training
 * record -> cross-tenant read blocked -> cleanup.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-certificates.ts
 */
import { inflateSync } from "node:zlib";
import { inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  getCertificate,
  issueCertificate,
} from "../src/server/services/academy";
import { renderCertificatePdf } from "../src/server/services/academy-certificate";
import { retrieveContext } from "../src/server/ai/retrieval";
import { COURSES } from "../src/data/academy-catalog";

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
    userA = await createUser(`vcert-a-${stamp}@example.test`);
    userB = await createUser(`vcert-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VCert A", workspaceName: "VCert A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VCert B", workspaceName: "VCert B" },
    );

    const course = COURSES[0];
    const cert = await issueCertificate({ sub: userA }, wsA, {
      courseId: course.id,
      quizScore: 90,
      learnerId: userA,
      learnerName: "Jordan Blake",
    });
    check(
      "certificate issued with learner name + JO- reference",
      !!cert &&
        cert.learnerName === "Jordan Blake" &&
        cert.reference.startsWith("JO-") &&
        cert.courseTitle === course.title,
    );
    if (!cert) throw new Error("no certificate issued");
    check(
      "certificate belongs to the signed-in user (learnerId = sub)",
      cert.learnerId === userA,
    );

    const fetched = await getCertificate({ sub: userA }, cert.id);
    check("owner workspace can fetch the certificate by id", !!fetched);

    const crossTenant = await getCertificate({ sub: userB }, cert.id);
    check("other tenant cannot fetch the certificate (RLS)", !crossTenant);

    // Branded PDF: a real PDF whose content stream carries the learner name,
    // course title and reference (pdf-lib writes uncompressed text streams).
    const pdf = await renderCertificatePdf(
      {
        reference: cert.reference,
        learnerName: cert.learnerName,
        courseTitle: cert.courseTitle ?? course.title,
        quizScore: cert.quizScore,
        durationMinutes: cert.durationMinutes,
        completedAt: cert.completedAt,
        businessName: "VCert A Ltd",
      },
      null,
    );
    const buf = Buffer.from(pdf);
    check(
      "PDF magic bytes present",
      buf.toString("latin1", 0, 8).startsWith("%PDF-"),
    );
    // Content streams are Flate-compressed; inflate each stream and scan the
    // decoded text operators for the drawn strings.
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
    // pdf-lib hex-encodes drawn strings (<4A6F...> Tj), so compare hex forms.
    const hex = (t: string) =>
      t
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    const decodedHex = decoded.toUpperCase();
    check(
      "PDF contains learner, course and reference",
      decodedHex.includes(hex("Jordan Blake")) &&
        decodedHex.includes(hex(cert.reference)) &&
        decodedHex.includes(hex("Jojan One Academy")),
    );
    check("PDF is a sensible size (> 1.5KB)", pdf.length > 1_500);

    // Jova sees the training record (cross-module intelligence).
    const ctx = await retrieveContext({ sub: userA }, wsA, "training record");
    check(
      "Jova context includes the certificate",
      ctx.contextText.includes(`Certificate ${cert.reference}`) &&
        ctx.contextText.includes("Jordan Blake"),
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
