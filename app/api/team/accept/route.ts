import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { acceptInvitation } from "@/server/services/invitations";
import { acceptInviteSchema } from "@/shared/schemas/team";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { trackEvent } from "@/server/services/events";

export async function POST(req: Request) {
  // Tight: acceptance validates a hashed token - throttle guessing.
  const limited = await enforceRateLimit(req, {
    bucket: "invite-accept",
    limit: 10,
    windowSec: 60,
  });
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to accept this invitation." },
      { status: 401 },
    );

  const body = await req.json().catch(() => null);
  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const result = await acceptInvitation(
    user.sub,
    user.email,
    parsed.data.token,
  );
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  await trackEvent({
    name: "team.accept",
    userId: user.sub,
    workspaceId: result.workspaceId,
    module: "settings",
  });
  return NextResponse.json({ ok: true, workspaceId: result.workspaceId });
}
