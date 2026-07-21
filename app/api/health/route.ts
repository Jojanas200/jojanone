import { NextResponse } from "next/server";
import { getSystemHealth } from "@/server/services/platform-health";

// Liveness/readiness probe for uptime monitoring and the go-live checklist.
// Checks a real DB round-trip plus which optional integrations are configured
// (booleans only, never secrets). Wire an uptime monitor to GET this and alert
// on non-200. Shares its logic with the /admin/health page.
export async function GET() {
  const h = await getSystemHealth();
  const checks: Record<string, string> = { database: h.database };
  for (const i of h.integrations) checks[i.key] = i.status;

  return NextResponse.json(
    { status: h.healthy ? "ok" : "degraded", checks },
    { status: h.healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
