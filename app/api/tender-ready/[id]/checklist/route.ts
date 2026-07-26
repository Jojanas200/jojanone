import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  addTenderChecklistItem,
  setTenderChecklistItem,
} from "@/server/services/tender";
import {
  addChecklistItemSchema,
  setChecklistItemSchema,
} from "@/shared/schemas/tender";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = addChecklistItemSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid item", issues: parsed.error.issues },
      { status: 400 },
    );
  const opportunity = await addTenderChecklistItem(claims, id, parsed.data);
  if (!opportunity)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ opportunity }, { status: 201 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = setChecklistItemSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );
  const opportunity = await setTenderChecklistItem(
    claims,
    id,
    parsed.data.itemId,
    parsed.data.done,
  );
  if (!opportunity)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ opportunity });
}
