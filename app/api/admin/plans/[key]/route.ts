import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { updatePlan } from "@/server/services/platform-plans";
import { planUpdateSchema } from "@/shared/schemas/platform";

// Edit a plan in the catalogue (operators only). Audited.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const { key } = await params;

  const body = await req.json().catch(() => null);
  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid plan" },
      { status: 400 },
    );

  const result = await updatePlan(actor, key, parsed.data);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
