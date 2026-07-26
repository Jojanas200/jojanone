import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createTenderResponse,
  listTenderResponses,
} from "@/server/services/tender-readiness";
import { createTenderResponseSchema } from "@/shared/schemas/tender-readiness";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const responses = await listTenderResponses(claims);
  return NextResponse.json({ responses });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createTenderResponseSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid response", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createTenderResponse(claims, ws, parsed.data);
  return NextResponse.json({ response: created }, { status: 201 });
}
