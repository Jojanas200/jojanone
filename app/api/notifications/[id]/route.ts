import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { markRead } from "@/server/services/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await markRead(claims, id);
  return NextResponse.json({ ok });
}
