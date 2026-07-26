import { NextResponse } from "next/server";
import { getClaims, getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import {
  regenerateInvitation,
  revokeInvitation,
} from "@/server/services/invitations";
import { getWorkspace } from "@/server/services/settings";
import { sendEmail } from "@/server/email/provider";
import { inviteEmail } from "@/server/email/templates";

type Ctx = { params: Promise<{ id: string }> };

// Resend a pending invite: rotate the token, extend expiry, re-email.
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });
  const role = await getWorkspaceRole(claims, ws);
  if (role !== "owner_admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const regenerated = await regenerateInvitation(claims, id);
  if (!regenerated)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const workspace = await getWorkspace(claims, ws);
  const { subject, html, text } = inviteEmail({
    workspaceName: workspace?.name ?? "your workspace",
    inviterEmail: user.email,
    token: regenerated.token,
  });
  const emailResult = await sendEmail({
    to: regenerated.email,
    subject,
    html,
    text,
  });
  return NextResponse.json({ ok: true, emailSent: emailResult.ok });
}

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
