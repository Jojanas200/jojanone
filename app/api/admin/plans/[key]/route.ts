import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import {
  archivePlan,
  setPlanPublished,
  updatePlan,
} from "@/server/services/platform-plans";
import { planUpdateSchema } from "@/shared/schemas/platform";

// Edit, publish/withdraw or retire a package (operators only). Audited.
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

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  // Publishing is its own transition: it re-checks that the package can
  // actually be bought before it reaches the public pricing page.
  if (body && "published" in body && Object.keys(body).length === 1) {
    const result = await setPlanPublished(actor, key, body.published === true);
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid package" },
      { status: 400 },
    );

  const result = await updatePlan(actor, key, parsed.data);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true, warning: result.warning ?? null });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const { key } = await params;
  const result = await archivePlan(actor, key);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
