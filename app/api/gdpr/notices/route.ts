import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  createPrivacyNotice,
  listPrivacyNotices,
} from "@/server/services/gdpr-registers";
import { createPrivacyNoticeSchema } from "@/shared/schemas/gdpr-registers";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const notices = await listPrivacyNotices(claims);
  return NextResponse.json({ notices });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createPrivacyNoticeSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid notice", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createPrivacyNotice(claims, ws, parsed.data);
  return NextResponse.json({ notice: created }, { status: 201 });
}
