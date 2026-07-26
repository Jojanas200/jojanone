import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { completeActivity } from "@/server/services/activity";

type Ctx = { params: Promise<{ id: string }> };

// Mark an activity/priority complete. Write access is enforced by RLS.
export async function PATCH(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const activity = await completeActivity(claims, id);
  if (!activity)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ activity });
}
