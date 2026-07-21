import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { setSubscriptionOverride } from "@/server/services/platform-tenants";
import { subscriptionOverrideSchema } from "@/shared/schemas/platform";

// Manually override a workspace's subscription/quota (audited). Platform admins
// only. Bypasses Stripe - the canonical subscription row is updated directly.
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

  const body = await req.json().catch(() => null);
  const parsed = subscriptionOverrideSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid override" },
      { status: 400 },
    );

  const result = await setSubscriptionOverride(actor, id, parsed.data);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
