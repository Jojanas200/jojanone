import { redirect } from "next/navigation";
import type { UserClaims } from "@/server/db";
import {
  getActiveWorkspaceId,
  getWorkspaceAccess,
  isModuleAllowed,
} from "@/server/services/workspaces";
import { getDisabledModules } from "@/server/services/platform-settings";

// Modules any member (including a scoped adviser) may always reach.
const ALWAYS_ALLOWED = new Set(["settings"]);

/**
 * Server-side module access guard, called at the top of a module page's render.
 * A scoped adviser who deep-links to a module outside their allow-list is
 * redirected to their first in-scope module BEFORE any data is fetched or sent
 * to the client. No-op for members with an unrestricted scope
 * (scopedModules === null) - i.e. everyone who is not a scoped adviser.
 *
 * Module route === "/" + moduleKey across the app, so no config lookup is
 * needed to build the destination.
 */
export async function requireModuleAccess(
  claims: UserClaims,
  moduleKey: string,
) {
  const ws = await getActiveWorkspaceId(claims);
  if (!ws) redirect("/onboarding");

  // Platform-wide module kill-switch (operator feature flag).
  if (!ALWAYS_ALLOWED.has(moduleKey)) {
    const disabled = await getDisabledModules();
    if (disabled.includes(moduleKey)) redirect("/dashboard");
  }

  const access = await getWorkspaceAccess(claims, ws);
  if (
    access.scopedModules &&
    !ALWAYS_ALLOWED.has(moduleKey) &&
    !isModuleAllowed(access.scopedModules, moduleKey)
  ) {
    const firstKey = access.scopedModules[0];
    redirect(firstKey ? `/${firstKey}` : "/settings");
  }
  return { workspaceId: ws, access };
}
