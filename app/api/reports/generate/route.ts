import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { composeReport, saveReport } from "@/server/services/reports";
import { generateReportSchema } from "@/shared/schemas/reports";

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const parsed = generateReportSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );

  const input = await composeReport(
    claims,
    parsed.data.reportType,
    parsed.data.period,
  );
  // Honour the section selection: excluded parts are simply omitted.
  const inc = parsed.data.include;
  const filtered = {
    ...input,
    summary: inc.summary ? input.summary : "",
    metrics: inc.metrics ? input.metrics : [],
    findings: inc.findings ? input.findings : [],
    priorityActions: inc.actions ? input.priorityActions : [],
  };
  const created = await saveReport(claims, ws, filtered);
  return NextResponse.json({ report: created }, { status: 201 });
}
