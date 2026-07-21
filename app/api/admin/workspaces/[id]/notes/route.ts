import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { addTenantNote } from "@/server/services/platform-support";

// Add an internal operator note to a tenant. Operators only; audited.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const result = await addTenantNote(actor, id, body?.body ?? "");
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
