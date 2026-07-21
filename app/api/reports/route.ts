import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { listReports, saveReport } from "@/server/services/reports";
import { saveReportSchema } from "@/shared/schemas/reports";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listReports(claims);
  return NextResponse.json({ reports: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = saveReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await saveReport(claims, ws, parsed.data);
  return NextResponse.json({ report: created }, { status: 201 });
}
