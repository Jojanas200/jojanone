import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  addRiskMitigation,
  setRiskMitigationDone,
} from "@/server/services/risk";
import {
  addRiskMitigationSchema,
  setRiskMitigationSchema,
} from "@/shared/schemas/risk";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = addRiskMitigationSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid mitigation", issues: parsed.error.issues },
      { status: 400 },
    );

  const risk = await addRiskMitigation(claims, id, parsed.data);
  if (!risk) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ risk }, { status: 201 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = setRiskMitigationSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );

  const risk = await setRiskMitigationDone(
    claims,
    id,
    parsed.data.mitigationId,
    parsed.data.done,
  );
  if (!risk) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ risk });
}
