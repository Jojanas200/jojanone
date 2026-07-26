import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { createDpia, listDpias } from "@/server/services/gdpr-registers";
import { createDpiaSchema } from "@/shared/schemas/gdpr-registers";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const dpias = await listDpias(claims);
  return NextResponse.json({ dpias });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createDpiaSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid DPIA", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createDpia(claims, ws, parsed.data);
  return NextResponse.json({ dpia: created }, { status: 201 });
}
