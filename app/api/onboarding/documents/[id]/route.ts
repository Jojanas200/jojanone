import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  deleteDocument,
  getDocumentObjectKey,
} from "@/server/services/documents";

const BUCKET = "evidence";
type Ctx = { params: Promise<{ id: string }> };

// Issue a short-lived signed URL for the document's binary.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const objectKey = await getDocumentObjectKey({ sub: user.sub }, id);
  if (!objectKey)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectKey, 60);
  if (error || !data)
    return NextResponse.json({ error: "Could not sign URL" }, { status: 400 });
  return NextResponse.json({ url: data.signedUrl });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const objectKey = await deleteDocument({ sub: user.sub }, id);
  if (objectKey) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([objectKey]);
  }
  return NextResponse.json({ ok: true });
}
