import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  deletePolicy,
  setPolicyStatus,
  updatePolicy,
} from "@/server/services/policies";
import {
  setPolicyStatusSchema,
  updatePolicySchema,
} from "@/shared/schemas/policies";

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

  if (body && "status" in body && Object.keys(body).length === 1) {
    const parsed = setPolicyStatusSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid status", issues: parsed.error.issues },
        { status: 400 },
      );
    const updated = await setPolicyStatus(claims, id, parsed.data.status);
    if (!updated)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ policy: updated });
  }

  const parsed = updatePolicySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );
  const updated = await updatePolicy(claims, id, parsed.data);
  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ policy: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deletePolicy(claims, id);
  return NextResponse.json({ ok });
}
