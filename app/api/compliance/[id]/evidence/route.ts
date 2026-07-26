import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  confirmObligationEvidence,
  listObligationEvidence,
} from "@/server/services/evidence";
import { confirmEvidenceSchema } from "@/shared/schemas/evidence";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const evidence = await listObligationEvidence(claims, id);
  return NextResponse.json({ evidence });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = confirmEvidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid evidence", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await confirmObligationEvidence(claims, id, parsed.data);
  if (!result)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ result }, { status: 201 });
}
