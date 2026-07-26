import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createScenarioRun,
  listScenarioRuns,
} from "@/server/services/scenarios";
import { createScenarioRunSchema } from "@/shared/schemas/scenarios";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const scenarios = await listScenarioRuns(claims);
  return NextResponse.json({ scenarios });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createScenarioRunSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid scenario", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createScenarioRun(claims, ws, parsed.data);
  return NextResponse.json({ scenario: created }, { status: 201 });
}
