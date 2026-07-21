import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { ask } from "@/server/ai/chat";
import { askSchema } from "@/shared/schemas/jova";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { trackEvent } from "@/server/services/events";

export async function POST(req: Request) {
  // AI calls are the most expensive path - cap per client.
  const limited = await enforceRateLimit(req, {
    bucket: "jova-ask",
    limit: 20,
    windowSec: 60,
  });
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid question", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await ask(claims, ws, parsed.data);
  await trackEvent({
    name: "jova.ask",
    userId: claims.sub,
    workspaceId: ws,
    module: "jova",
    metadata: { mode: result.mode },
  });
  return NextResponse.json({ result });
}
