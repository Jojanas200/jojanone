/**
 * End-to-end verification of Jova file attachments against the REAL Supabase
 * project: text/PDF/DOCX extraction (using files generated in-process),
 * clipping, unsupported-type rejection, and ask() integration - the
 * attachment joins the context, is cited as a source, and is recorded on the
 * stored user message. Cleanup at the end.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-jova-attachments.ts
 */
import { eq, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { adminDb } from "../src/server/db";
import { messages, organisations, workspaces } from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import {
  ATTACHMENT_MAX_CHARS,
  extractAttachmentText,
} from "../src/server/ai/attachments";
import { ask } from "../src/server/ai/chat";
import { providerFor } from "../src/server/ai/provider";

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
  let wsA = "";

  try {
    // --- Extraction ----------------------------------------------------------
    const txt = await extractAttachmentText(
      "notes.txt",
      "text/plain",
      Buffer.from("Northwind notice period is 60 days.", "utf8"),
    );
    check(
      "plain text extracted",
      txt.ok && txt.attachment.text.includes("60 days"),
    );

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 200]);
    page.drawText("Renewal due on 1 November 2026.", {
      x: 40,
      y: 100,
      size: 12,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    });
    const pdfRes = await extractAttachmentText(
      "contract.pdf",
      "application/pdf",
      Buffer.from(await pdfDoc.save()),
    );
    check(
      "PDF text extracted",
      pdfRes.ok && pdfRes.attachment.text.includes("1 November 2026"),
    );

    const docxBuf = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun("Quarterly dispatch report obligations."),
                ],
              }),
            ],
          },
        ],
      }),
    );
    const docxRes = await extractAttachmentText(
      "obligations.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      Buffer.from(docxBuf),
    );
    check(
      "DOCX text extracted",
      docxRes.ok && docxRes.attachment.text.includes("Quarterly dispatch"),
    );

    const long = await extractAttachmentText(
      "big.txt",
      "text/plain",
      Buffer.from("x".repeat(ATTACHMENT_MAX_CHARS + 5_000), "utf8"),
    );
    check(
      "long files are clipped and flagged truncated",
      long.ok &&
        long.attachment.truncated &&
        long.attachment.text.length === ATTACHMENT_MAX_CHARS,
    );

    const bad = await extractAttachmentText(
      "photo.png",
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
    check("unsupported types are rejected with a clear error", !bad.ok);

    // --- ask() integration ---------------------------------------------------
    userA = await createUser(`vja-a-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VJA A", workspaceName: "VJA A" },
    );
    const result = await ask(
      { sub: userA },
      wsA,
      {
        question: "What does the attached contract say about notice?",
        attachment: {
          name: "contract.txt",
          content: "The notice period is 60 days either side.",
        },
      },
      { provider: providerFor("deterministic") },
    );
    check(
      "attachment cited as a source on the answer",
      result.sources.some((s) => s.module === "attachment"),
    );
    check(
      "deterministic mode says it could not analyse the file",
      result.answer.includes("could not analyse the attached file"),
    );
    const stored = await adminDb
      .select({ content: messages.content, sender: messages.sender })
      .from(messages)
      .where(eq(messages.conversationId, result.conversationId));
    check(
      "stored user message records the attachment",
      stored.some(
        (m) =>
          m.sender === "user" &&
          m.content.includes("[Attached file: contract.txt]"),
      ),
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
