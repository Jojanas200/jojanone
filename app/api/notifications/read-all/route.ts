import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { markAllRead } from "@/server/services/notifications";

export async function POST() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const count = await markAllRead(claims);
  return NextResponse.json({ count });
}
