import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import { getWorkspace } from "@/server/services/settings";
import { createInvitation } from "@/server/services/invitations";
import { sendEmail } from "@/server/email/provider";
import { inviteEmail } from "@/server/email/templates";
import { createInviteSchema } from "@/shared/schemas/team";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { trackEvent } from "@/server/services/events";

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    bucket: "team-invite",
    limit: 15,
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
      { error: "Only workspace owners can invite teammates." },
      { status: 403 },
    );

  const body = await req.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid invite", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createInvitation(claims, ws, parsed.data);
  if (!created.ok)
    return NextResponse.json({ error: created.error }, { status: 409 });

  // Send the invite email (best-effort - the invite exists regardless).
  const workspace = await getWorkspace(claims, ws);
  const { subject, html, text } = inviteEmail({
    workspaceName: workspace?.name ?? "your workspace",
    inviterEmail: user.email,
    token: created.result.token,
  });
  const emailResult = await sendEmail({
    to: created.result.email,
    subject,
    html,
    text,
  });

  await trackEvent({
    name: "team.invite",
    userId: user.sub,
    workspaceId: ws,
    module: "settings",
    metadata: { role: parsed.data.role },
  });

  return NextResponse.json({
    ok: true,
    id: created.result.id,
    emailSent: emailResult.ok,
    emailSkipped: emailResult.skipped ?? false,
  });
}
