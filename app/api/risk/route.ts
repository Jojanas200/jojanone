import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { createRisk, listRisks } from "@/server/services/risk";
import { createRiskSchema } from "@/shared/schemas/risk";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listRisks(claims);
  return NextResponse.json({ risks: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createRiskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid risk", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await createRisk(claims, ws, parsed.data);
  return NextResponse.json({ risk: created }, { status: 201 });
}
