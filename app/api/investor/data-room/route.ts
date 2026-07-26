import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createDataRoomItem,
  listDataRoomItems,
} from "@/server/services/investor-readiness";
import { createDataRoomItemSchema } from "@/shared/schemas/investor-readiness";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listDataRoomItems(claims);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createDataRoomItemSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid item", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createDataRoomItem(claims, ws, parsed.data);
  return NextResponse.json({ item: created }, { status: 201 });
}
