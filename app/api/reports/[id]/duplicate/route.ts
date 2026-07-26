import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { duplicateReport } from "@/server/services/reports";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const created = await duplicateReport(claims, id);
  if (!created)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ report: created }, { status: 201 });
}
