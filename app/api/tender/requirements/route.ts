import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createTenderRequirement,
  listTenderRequirements,
} from "@/server/services/tender-readiness";
import { createTenderRequirementSchema } from "@/shared/schemas/tender-readiness";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const requirements = await listTenderRequirements(claims);
  return NextResponse.json({ requirements });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createTenderRequirementSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid requirement", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createTenderRequirement(claims, ws, parsed.data);
  return NextResponse.json({ requirement: created }, { status: 201 });
}
