import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createGovernanceRecord,
  listGovernanceRecords,
} from "@/server/services/governance";
import { createGovernanceRecordSchema } from "@/shared/schemas/governance";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listGovernanceRecords(claims);
  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createGovernanceRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid record", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await createGovernanceRecord(claims, ws, parsed.data);
  return NextResponse.json({ record: created }, { status: 201 });
}
