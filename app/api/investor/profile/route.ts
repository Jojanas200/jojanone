import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  getInvestorProfile,
  saveInvestorProfile,
} from "@/server/services/investor-readiness";
import { saveInvestorProfileSchema } from "@/shared/schemas/investor-readiness";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getInvestorProfile(claims);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = saveInvestorProfileSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid profile", issues: parsed.error.issues },
      { status: 400 },
    );

  const saved = await saveInvestorProfile(claims, ws, parsed.data);
  return NextResponse.json({ profile: saved });
}
