import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { listDocuments, recordDocument } from "@/server/services/documents";
import {
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
  documentMetaSchema,
} from "@/shared/schemas/documents";

const BUCKET = "evidence";

// Keep only characters that are safe in a Storage object key.
const safeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };
  const ws = await getActiveWorkspaceId(claims);
  if (!ws) return NextResponse.json({ documents: [] });

  const sourceModule =
    new URL(req.url).searchParams.get("sourceModule") ?? undefined;
  const rows = await listDocuments(claims, sourceModule);
  // Never leak the raw object key to the client — downloads go via a signed URL.
  const documents = rows.map(({ objectKey: _o, ...rest }) => rest);
  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size === 0)
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_DOCUMENT_BYTES)
    return NextResponse.json({ error: "File exceeds 50MB" }, { status: 413 });
  if (!ALLOWED_DOCUMENT_MIME.includes(file.type as never))
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 },
    );

  const parsed = documentMetaSchema.safeParse({
    title: form.get("title") ?? file.name,
    category: form.get("category") ?? "Other",
    owner: form.get("owner") || undefined,
    issueDate: form.get("issueDate") || undefined,
    reviewDate: form.get("reviewDate") || undefined,
    accessLevel: form.get("accessLevel") || undefined,
    description: form.get("description") || undefined,
    sourceModule: form.get("sourceModule") || undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid metadata", issues: parsed.error.issues },
      { status: 400 },
    );

  const objectKey = `${ws}/${parsed.data.sourceModule}/${crypto.randomUUID()}_${safeName(
    file.name,
  )}`;

  // Upload with the request-scoped client so object RLS (path = workspace_id/…
  // + writer role) is enforced. A read-only member / adviser is rejected here.
  const supabase = await createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectKey, bytes, { contentType: file.type, upsert: false });
  if (upErr)
    return NextResponse.json(
      { error: `Upload failed: ${upErr.message}` },
      { status: 400 },
    );

  const record = await recordDocument(claims, ws, parsed.data, {
    objectKey,
    mimeType: file.type,
    sizeBytes: file.size,
    originalName: file.name,
  });

  const { objectKey: _o, ...safe } = record;
  return NextResponse.json({ document: safe }, { status: 201 });
}
