import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  deleteReport,
  getReport,
  renameReport,
} from "@/server/services/reports";
import { renameReportSchema } from "@/shared/schemas/reports";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await getReport(claims, id);
  if (!report)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = renameReportSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  const ok = await renameReport(claims, id, parsed.data.title);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteReport(claims, id);
  return NextResponse.json({ ok });
}
