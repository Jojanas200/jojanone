import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { broadcastNotification } from "@/server/services/platform-support";

// Send an in-app notification to a tenant's workspace. Operators only; audited.
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
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
  } | null;
  const result = await broadcastNotification(actor, id, {
    title: body?.title ?? "",
    description: body?.description,
  });
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
