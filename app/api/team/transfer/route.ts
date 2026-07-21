import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import { transferOwnership } from "@/server/services/members";
import { transferOwnershipSchema } from "@/shared/schemas/team";
import { enforceRateLimit } from "@/server/security/rate-limit";

// Hand over ownership: the target becomes owner_admin and the caller steps down.
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    bucket: "team-transfer",
    limit: 5,
    windowSec: 60,
  });
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const role = await getWorkspaceRole(claims, ws);
  if (role !== "owner_admin")
    return NextResponse.json(
      { error: "Only an owner can transfer ownership." },
      { status: 403 },
    );

  const body = await req.json().catch(() => null);
  const parsed = transferOwnershipSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await transferOwnership(
    claims,
    ws,
    parsed.data.membershipId,
    parsed.data.stepDownRole,
  );
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
