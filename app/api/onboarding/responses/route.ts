import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth/session";
import {
  getBusinessProfile,
  updateBusinessProfile,
} from "@/server/services/settings";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { provisionWorkspace } from "@/server/services/provisioning";
import { getOnboarding, saveOnboarding } from "@/server/services/onboarding";
import { isPlatformAdmin } from "@/server/services/platform-admin";
import { getPlatformSettings } from "@/server/services/platform-settings";
import { trackEvent } from "@/server/services/events";
import type { OnboardingAnswers } from "@/shared/onboarding/types";

const asName = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };
  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({
      answers: {},
      completedAt: null,
      complete: false,
    });
  const state = await getOnboarding(claims, ws);
  return NextResponse.json(state);
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claims = { sub: user.sub };

  const body = (await req.json().catch(() => null)) as OnboardingAnswers | null;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (Object.keys(body).length > 400)
    return NextResponse.json({ error: "Too many fields" }, { status: 400 });

  // Provision the workspace on the first save if the user doesn't have one yet.
  let ws = await getActiveWorkspaceId(claims);
  if (!ws) {
    const settings = await getPlatformSettings();
    if (!settings.signupsEnabled && !isPlatformAdmin(user.email))
      return NextResponse.json(
        { error: "New sign-ups are currently paused. Please check back soon." },
        { status: 403 },
      );
    const name =
      asName(body["company.legal_name"]) ??
      asName(body["company.trading_name"]) ??
      asName(body["owner.full_name"]) ??
      "My business";
    ws = await provisionWorkspace(claims, {
      orgName: name,
      workspaceName: name,
    });
    await trackEvent({
      name: "workspace.created",
      userId: user.sub,
      workspaceId: ws,
      module: "onboarding",
    });
  }

  const state = await saveOnboarding(claims, ws, body);

  // Fan the owner's name out of the answers blob: auth metadata (the per-user
  // identity used on certificates) and the business profile's primary contact
  // when that is still empty. Best-effort - never fails the save.
  const ownerName = asName(body["owner.full_name"]);
  if (ownerName) {
    if (ownerName !== user.fullName) {
      try {
        const supabase = await createClient();
        await supabase.auth.updateUser({ data: { full_name: ownerName } });
      } catch {
        // metadata update is best-effort
      }
    }
    try {
      const profile = await getBusinessProfile(claims, ws);
      if (profile && !profile.primaryContactName?.trim())
        await updateBusinessProfile(claims, ws, {
          primaryContactName: ownerName,
        });
    } catch {
      // profile fan-out is best-effort
    }
  }

  // Jurisdiction flows into Business Memory: the registered country answered
  // at onboarding lands on the business profile (when not already set) so
  // Jova and future jurisdiction-aware features can use it.
  const country = asName(body["company.registered_country"]);
  if (country) {
    try {
      const profile = await getBusinessProfile(claims, ws);
      if (profile && !profile.registeredCountry?.trim())
        await updateBusinessProfile(claims, ws, {
          registeredCountry: country,
        });
    } catch {
      // profile fan-out is best-effort
    }
  }

  return NextResponse.json(state);
}
