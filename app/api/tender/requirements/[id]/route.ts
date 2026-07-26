import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  deleteTenderRequirement,
  updateTenderRequirement,
} from "@/server/services/tender-readiness";
import { updateTenderRequirementSchema } from "@/shared/schemas/tender-readiness";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateTenderRequirementSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );

  const updated = await updateTenderRequirement(claims, id, parsed.data);
  if (!updated)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ requirement: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteTenderRequirement(claims, id);
  return NextResponse.json({ ok });
}
