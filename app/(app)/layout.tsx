import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth/session";
import {
  getWorkspaceAccess,
  listMyWorkspaces,
} from "@/server/services/workspaces";
import { isPlatformAdmin } from "@/server/services/platform-admin";
import { getUserTheme } from "@/server/services/prefs";
import { getDisabledModules } from "@/server/services/platform-settings";
import { getCurrentLogo } from "@/server/services/documents";
import { AppShell } from "./AppShell";
import { Heartbeat } from "./Heartbeat";
import { ThemeSync } from "./ThemeSync";
import { PlatformBanner } from "./PlatformBanner";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { SignOutButton } from "../SignOutButton";
import { BrandLogo } from "../BrandLogo";

/**
 * Authenticated app shell. One place enforces auth + workspace, so the pages
 * below only render content. Login and onboarding live outside this group.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const claims = { sub: user.sub };
  const platformAdmin = isPlatformAdmin(user.email);

  const workspaces = await listMyWorkspaces(claims);
  if (workspaces.length === 0)
    redirect(platformAdmin ? "/admin" : "/onboarding");
  const active = workspaces[0];

  // A suspended workspace is blocked from the app entirely.
  if (active.suspendedAt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <BrandLogo className="h-8 w-auto" />
        <h1 className="text-lg font-semibold text-foreground">
          Your workspace is suspended
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Access to {active.name} has been paused. Please contact Jojan One
          support to resolve this.
        </p>
        <SignOutButton />
      </div>
    );
  }

  const access = await getWorkspaceAccess(claims, active.id);
  const impersonating =
    (await cookies()).get("jj_impersonating")?.value ?? null;
  const [savedTheme, disabledModules, logo] = await Promise.all([
    getUserTheme(claims),
    getDisabledModules(),
    getCurrentLogo(claims),
  ]);
  const brandLogoSrc = logo ? `/api/branding/logo?v=${logo.id}` : null;

  return (
    <>
      <ThemeSync dbTheme={savedTheme} />
      <PlatformBanner />
      {impersonating ? (
        <ImpersonationBanner email={impersonating} />
      ) : (
        <Heartbeat />
      )}
      <AppShell
        workspaceName={active.name}
        role={active.role}
        canWrite={access.canWrite}
        allowedModules={access.scopedModules}
        disabledModules={disabledModules}
        isPlatformAdmin={platformAdmin && !impersonating}
        brandLogoSrc={brandLogoSrc}
      >
        {children}
      </AppShell>
    </>
  );
}
