import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { createAssignment, listAssignments } from "@/server/services/academy";
import { createAssignmentSchema } from "@/shared/schemas/academy";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listAssignments(claims);
  return NextResponse.json({ assignments: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await createAssignment(claims, ws, parsed.data);
  return NextResponse.json({ assignment: created }, { status: 201 });
}
