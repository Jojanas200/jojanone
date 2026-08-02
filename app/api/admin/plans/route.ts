import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { createPlan } from "@/server/services/platform-plans";
import { planCreateSchema } from "@/shared/schemas/platform";

// Create a package. Operators only, audited. Pricing is pushed to Stripe on
// save; a Stripe failure returns a warning rather than losing the design.
export async function POST(req: Request) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );

  const body = await req.json().catch(() => null);
  const parsed = planCreateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid package" },
      { status: 400 },
    );

  const result = await createPlan(actor, parsed.data);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true, warning: result.warning ?? null });
}
