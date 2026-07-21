import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { completeOnboarding } from "@/server/services/onboarding";
import { trackEvent } from "@/server/services/events";

export async function POST() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const result = await completeOnboarding(claims, ws);
  if (!result.ok) return NextResponse.json(result, { status: 422 });

  await trackEvent({
    name: "onboarding.completed",
    userId: user.sub,
    workspaceId: ws,
    module: "onboarding",
  });
  return NextResponse.json(result);
}
