import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createProcessingActivity,
  listProcessingActivities,
} from "@/server/services/gdpr";
import { createProcessingActivitySchema } from "@/shared/schemas/gdpr";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listProcessingActivities(claims);
  return NextResponse.json({ activities: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createProcessingActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid activity", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await createProcessingActivity(claims, ws, parsed.data);
  return NextResponse.json({ activity: created }, { status: 201 });
}
