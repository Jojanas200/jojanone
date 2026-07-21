import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { deleteRisk, setRiskStatus, updateRisk } from "@/server/services/risk";
import { setRiskStatusSchema, updateRiskSchema } from "@/shared/schemas/risk";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  // A status change (accept/close/reopen) carries { status, reason? }.
  if (body && "status" in body) {
    const parsed = setRiskStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const updated = await setRiskStatus(
      claims,
      id,
      parsed.data.status,
      parsed.data.reason,
    );
    if (!updated)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ risk: updated });
  }

  const parsed = updateRiskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const updated = await updateRisk(claims, id, parsed.data);
  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ risk: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteRisk(claims, id);
  return NextResponse.json({ ok });
}
