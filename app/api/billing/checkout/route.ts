import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import { createCheckoutSession } from "@/server/services/billing-sessions";

export async function POST(req: Request) {
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
      { error: "Only workspace owners can manage billing." },
      { status: 403 },
    );

  const body = (await req.json().catch(() => null)) as {
    planKey?: string;
  } | null;
  if (!body?.planKey)
    return NextResponse.json({ error: "planKey required" }, { status: 400 });

  const result = await createCheckoutSession(ws, body.planKey, user.email);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.code });
  return NextResponse.json({ url: result.url });
}
