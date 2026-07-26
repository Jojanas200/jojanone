import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createEntity,
  listEntities,
} from "@/server/services/business-entities";
import { createEntitySchema } from "@/shared/schemas/business-entities";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entities = await listEntities(claims);
  return NextResponse.json({ entities });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createEntitySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid entity", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createEntity(claims, ws, parsed.data);
  return NextResponse.json({ entity: created }, { status: 201 });
}
