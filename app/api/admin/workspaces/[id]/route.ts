import { NextResponse } from "next/server";
import {
  requirePlatformAdmin,
  suspendWorkspace,
  unsuspendWorkspace,
} from "@/server/services/platform-admin";

type Ctx = { params: Promise<{ id: string }> };

// Suspend / unsuspend a workspace. Platform-admin only; every action is audited
// inside the service via logPlatformAction.
export async function POST(req: Request, { params }: Ctx) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    reason?: string;
  } | null;

  if (body?.action === "suspend") {
    await suspendWorkspace(actor, id, body.reason);
    return NextResponse.json({ ok: true, suspended: true });
  }
  if (body?.action === "unsuspend") {
    await unsuspendWorkspace(actor, id);
    return NextResponse.json({ ok: true, suspended: false });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
