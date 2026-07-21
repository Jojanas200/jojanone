import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  assignAcknowledgements,
  listAcknowledgements,
} from "@/server/services/policy-acknowledgements";
import { assignAcknowledgementsSchema } from "@/shared/schemas/policies";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const roster = await listAcknowledgements(claims, id);
  return NextResponse.json({ acknowledgements: roster });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = assignAcknowledgementsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid assignment", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await assignAcknowledgements(claims, id, parsed.data);
  if (created === null)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ created }, { status: 201 });
}
