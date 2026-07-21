import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import { revokeInvitation } from "@/server/services/invitations";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });
  const role = await getWorkspaceRole(claims, ws);
  if (role !== "owner_admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const ok = await revokeInvitation(claims, id);
  return NextResponse.json({ ok });
}
