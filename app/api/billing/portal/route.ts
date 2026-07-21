import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import { createPortalSession } from "@/server/services/billing-sessions";

export async function POST() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const role = await getWorkspaceRole(claims, ws);
  if (role !== "owner_admin")
    return NextResponse.json(
      { error: "Only workspace owners can manage billing." },
      { status: 403 },
    );

  const result = await createPortalSession(ws);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.code });
  return NextResponse.json({ url: result.url });
}
