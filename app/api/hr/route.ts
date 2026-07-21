import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { createEmployee, listEmployees } from "@/server/services/hr";
import { createEmployeeSchema } from "@/shared/schemas/hr";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listEmployees(claims);
  return NextResponse.json({ employees: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid employee", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await createEmployee(claims, ws, parsed.data);
  return NextResponse.json({ employee: created }, { status: 201 });
}
