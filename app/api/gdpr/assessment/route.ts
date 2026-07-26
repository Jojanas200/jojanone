import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  getGdprAssessment,
  saveGdprAssessment,
} from "@/server/services/gdpr-registers";
import { saveGdprAssessmentSchema } from "@/shared/schemas/gdpr-registers";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const assessment = await getGdprAssessment(claims);
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
  const parsed = saveGdprAssessmentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid assessment", issues: parsed.error.issues },
      { status: 400 },
    );

  const saved = await saveGdprAssessment(claims, ws, parsed.data.answers);
  return NextResponse.json({ assessment: saved });
}
