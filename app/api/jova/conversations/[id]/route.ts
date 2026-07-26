import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { deleteConversation, listConversationMessages } from "@/server/ai/chat";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const messages = await listConversationMessages(claims, id);
  return NextResponse.json({ messages });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteConversation(claims, id);
  return NextResponse.json({ ok });
}
