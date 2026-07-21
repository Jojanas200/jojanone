import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { updatePlatformSettings } from "@/server/services/platform-settings";
import { platformSettingsSchema } from "@/shared/schemas/platform";

// Update cross-tenant platform settings (LLM provider/model, signups). Gated by
// requirePlatformAdmin(); every change is written to the platform audit log.
export async function POST(req: Request) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );

  const body = await req.json().catch(() => null);
  const parsed = platformSettingsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid settings", issues: parsed.error.issues },
      { status: 400 },
    );

  const saved = await updatePlatformSettings(actor, parsed.data);
  return NextResponse.json({ ok: true, settings: saved });
}
