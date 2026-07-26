import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  getReadinessAssessment,
  saveReadinessAssessment,
} from "@/server/services/investor-readiness";
import { saveReadinessAssessmentSchema } from "@/shared/schemas/investor-readiness";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const assessment = await getReadinessAssessment(claims);
  return NextResponse.json({ assessment });
}

export async function PUT(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = saveReadinessAssessmentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid assessment", issues: parsed.error.issues },
      { status: 400 },
    );

  const saved = await saveReadinessAssessment(claims, ws, parsed.data.answers);
  return NextResponse.json({ assessment: saved });
}
