import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { enforceRateLimit } from "@/server/security/rate-limit";
import {
  ATTACHMENT_MAX_BYTES,
  extractAttachmentText,
} from "@/server/ai/attachments";

// Extracts the text of a file the user wants Jova to read (PDF, DOCX, TXT,
// MD, CSV, JSON). Nothing is stored - the client sends the extracted text
// with its question and Jova answers over it as part of the grounded context.
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    bucket: "jova-attach",
    limit: 10,
    windowSec: 60,
  });
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > ATTACHMENT_MAX_BYTES)
    return NextResponse.json(
      { error: "File too large (8MB maximum)." },
      { status: 400 },
    );

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await extractAttachmentText(file.name, file.type || "", buf);
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ attachment: result.attachment });
  } catch (err) {
    console.error("jova attachment extraction failed:", err);
    return NextResponse.json(
      { error: "Could not process that file. Try a different format." },
      { status: 500 },
    );
  }
}
