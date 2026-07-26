import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { completeOnboarding } from "@/server/services/onboarding";
import { syncWorkspaceMemory } from "@/server/services/jova-memory";
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

  // Seed Jova's baseline memory of this business. Fire-and-forget so a cold
  // embedding-model load never delays completion; no-op when embeddings are off.
  void syncWorkspaceMemory(claims, ws).catch(() => {});

  return NextResponse.json(result);
}
