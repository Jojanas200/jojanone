import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  deleteObligation,
  setObligationStatus,
  updateObligation,
} from "@/server/services/compliance";
import { updateObligationSchema } from "@/shared/schemas/compliance";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateObligationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const keys = Object.keys(data);
  const updated =
    keys.length === 1 && keys[0] === "status" && data.status
      ? await setObligationStatus(claims, id, data.status)
      : await updateObligation(claims, id, data);

  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ obligation: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteObligation(claims, id);
  return NextResponse.json({ ok });
}
