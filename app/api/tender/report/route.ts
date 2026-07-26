import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { generateTenderReport } from "@/server/services/tender-readiness";

// Compose a Tender Readiness Report from policies, evidence, compliance, GDPR
// and the tender pipeline, and save it to the Reports library.
export async function POST() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const report = await generateTenderReport(claims, ws);
  return NextResponse.json({ report }, { status: 201 });
}
