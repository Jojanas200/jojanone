import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { generateInvestorReport } from "@/server/services/investor-readiness";

// Compose an Investor Readiness Report from the current assessment, profile,
// data room and due-diligence items, and save it to the Reports library.
export async function POST() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const report = await generateInvestorReport(claims, ws);
  return NextResponse.json({ report }, { status: 201 });
}
