import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  deleteDueDiligenceItem,
  updateDueDiligenceItem,
} from "@/server/services/investor";
import { updateDueDiligenceItemSchema } from "@/shared/schemas/investor";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateDueDiligenceItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const updated = await updateDueDiligenceItem(claims, id, parsed.data);
  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteDueDiligenceItem(claims, id);
  return NextResponse.json({ ok });
}
