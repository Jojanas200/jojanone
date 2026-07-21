import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  removeAcknowledgement,
  setAcknowledgementStatus,
} from "@/server/services/policy-acknowledgements";
import { setAcknowledgementSchema } from "@/shared/schemas/policies";

type Ctx = { params: Promise<{ id: string; ackId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id, ackId } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = setAcknowledgementSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid status", issues: parsed.error.issues },
      { status: 400 },
    );

  const updated = await setAcknowledgementStatus(
    claims,
    id,
    ackId,
    parsed.data.status,
    parsed.data.notes ?? undefined,
  );
  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ acknowledgement: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, ackId } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await removeAcknowledgement(claims, id, ackId);
  return NextResponse.json({ ok });
}
