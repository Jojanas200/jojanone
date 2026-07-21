import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import {
  confirmUserEmail,
  eraseUser,
  generateRecoveryLink,
  setUserBanned,
} from "@/server/services/platform-users";

// Platform-admin actions on a single user. All audited. `erase` is a GDPR
// right-to-erasure: it removes the user's memberships, preferences and account.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    email?: string;
  } | null;

  let result;
  switch (body?.action) {
    case "disable":
      result = await setUserBanned(actor, id, true);
      break;
    case "enable":
      result = await setUserBanned(actor, id, false);
      break;
    case "confirm":
      result = await confirmUserEmail(actor, id);
      break;
    case "recovery":
      if (!body.email)
        return NextResponse.json({ error: "email required" }, { status: 400 });
      result = await generateRecoveryLink(actor, body.email);
      break;
    case "erase":
      result = await eraseUser(actor, id);
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}
