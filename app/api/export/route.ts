import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import { getWorkspaceExport } from "@/server/services/data-export";
import { enforceRateLimit } from "@/server/security/rate-limit";

// GDPR data-portability export: a workspace owner/manager downloads their own
// workspace's business records. Runs under the caller's RLS context, so it can
// only ever return their own data.
const EXPORT_ROLES = new Set(["owner_admin", "manager"]);

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, {
    bucket: "data-export",
    limit: 5,
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
  if (!role || !EXPORT_ROLES.has(role))
    return NextResponse.json(
      { error: "Only an owner or manager can export the workspace's data." },
      { status: 403 },
    );

  const data = await getWorkspaceExport(claims, ws);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="jojanone-export-${ws}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
