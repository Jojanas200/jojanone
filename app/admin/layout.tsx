import Link from "next/link";
import { requirePlatformAdmin } from "@/server/services/platform-admin";
import { BrandLogo } from "../BrandLogo";
import { SignOutButton } from "../SignOutButton";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { AdminNav } from "./AdminNav";

// Every /admin route is per-request (cross-tenant DB reads behind an auth gate)
// and must never be statically prerendered at build time - otherwise the build
// worker executes the analytics/overview queries and can time out.
export const dynamic = "force-dynamic";

// Platform-admin surface. requirePlatformAdmin() gates every page here: signed
// out -> /login; signed in but not on the PLATFORM_ADMIN_EMAILS allowlist ->
// 404 (the surface's existence is not revealed to tenants).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-6 w-auto" priority />
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
            Platform admin
          </span>
          {user.role === "analyst" && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Read only
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{user.email}</span>
          <ThemeSwitcher
            persist
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          />
          <Link href="/dashboard" className="hover:text-foreground">
            Exit to app
          </Link>
          <SignOutButton />
        </div>
      </header>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
