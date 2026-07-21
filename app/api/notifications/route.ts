import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import {
  listNotifications,
  unreadCount,
} from "@/server/services/notifications";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [items, unread] = await Promise.all([
    listNotifications(claims),
    unreadCount(claims),
  ]);
  return NextResponse.json({ notifications: items, unread });
}
