import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { recordHeartbeat } from "@/server/services/events";
import { enforceRateLimit } from "@/server/security/rate-limit";

// Lightweight session heartbeat pinged by the authenticated app shell. Makes
// DAU/WAU/MAU reflect every active user. Server-throttled per user, so frequent
// pings collapse to at most one event per window.
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    bucket: "heartbeat",
    limit: 30,
    windowSec: 60,
  });
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const ws = await getActiveWorkspaceId({ sub: user.sub });
  await recordHeartbeat(user.sub, ws);
  return NextResponse.json({ ok: true });
}
