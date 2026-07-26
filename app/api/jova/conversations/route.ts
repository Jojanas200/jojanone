import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { listConversations } from "@/server/ai/chat";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const conversations = await listConversations(claims);
  return NextResponse.json({ conversations });
}
