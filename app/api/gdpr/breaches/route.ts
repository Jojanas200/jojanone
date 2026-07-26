import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createDataBreach,
  listDataBreaches,
} from "@/server/services/gdpr-registers";
import { createDataBreachSchema } from "@/shared/schemas/gdpr-registers";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const breaches = await listDataBreaches(claims);
  return NextResponse.json({ breaches });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createDataBreachSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid breach", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createDataBreach(claims, ws, parsed.data);
  return NextResponse.json({ breach: created }, { status: 201 });
}
