import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { deleteScenarioRun } from "@/server/services/scenarios";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteScenarioRun(claims, id);
  return NextResponse.json({ ok });
}
