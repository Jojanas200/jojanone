import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  deleteGovernanceRecord,
  setGovernanceStatus,
  updateGovernanceRecord,
} from "@/server/services/governance";
import {
  setGovernanceStatusSchema,
  updateGovernanceRecordSchema,
} from "@/shared/schemas/governance";

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

  if (body && "status" in body) {
    const parsed = setGovernanceStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const updated = await setGovernanceStatus(claims, id, parsed.data.status);
    if (!updated)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ record: updated });
  }

  const parsed = updateGovernanceRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const updated = await updateGovernanceRecord(claims, id, parsed.data);
  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteGovernanceRecord(claims, id);
  return NextResponse.json({ ok });
}
