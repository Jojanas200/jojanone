"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MODULES_BY_SECTION } from "@/config/modules.config";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandLogo } from "../BrandLogo";
import { SignOutButton } from "../SignOutButton";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { NotificationBell } from "./NotificationBell";
import { AccessProvider } from "./access";

// Routes that have a real page today. Others render as disabled "soon" items.
const IMPLEMENTED = new Set([
  "/dashboard",
  "/contracts",
  "/compliance",
  "/risk",
  "/hr",
  "/gdpr",
  "/governance",
  "/policies",
  "/investor-ready",
  "/tender-ready",
  "/settings",
  "/executive",
  "/timeline",
  "/business-map",
  "/simulator",
  "/academy",
  "/reports",
  "/import",
  "/jova",
  "/companies-house",
  "/evidence",
  "/billing",
]);

// Modules an adviser always keeps in scope regardless of their allow-list.
const ALWAYS_ALLOWED = new Set(["settings"]);

function Nav({
  pathname,
  onNavigate,
  allowedModules,
  disabledModules = [],
}: {
  pathname: string;
  onNavigate?: () => void;
  allowedModules: string[] | null;
  disabledModules?: string[];
}) {
  const item =
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";
  const inScope = (key: string) =>
    (!allowedModules ||
      allowedModules.includes(key) ||
      ALWAYS_ALLOWED.has(key)) &&
    (ALWAYS_ALLOWED.has(key) || !disabledModules.includes(key));
  return (
    <nav aria-label="Modules" className="flex-1 overflow-y-auto px-3 py-4">
      {MODULES_BY_SECTION.map(({ section, items }) => {
        const visible = items.filter((m) => inScope(m.key));
        if (visible.length === 0) return null;
        return (
          <div key={section} className="mb-5">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section}
            </div>
            <ul className="space-y-0.5">
              {visible.map((m) => {
                const Icon = m.icon;
                const active = pathname === m.route;
                if (!IMPLEMENTED.has(m.route)) {
                  return (
                    <li key={m.key}>
                      <span
                        className={`${item} cursor-not-allowed text-sidebar-foreground/40`}
                        title="Coming soon"
                        aria-disabled="true"
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{m.title}</span>
                        <span className="text-[10px] uppercase tracking-wide">
                          soon
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={m.key}>
                    <Link
                      href={m.route}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`${item} ${
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{m.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// Tenant brand: the workspace's own logo in the nav header when it has one,
// otherwise the Jojan One mark. Sidebar-only — landing/auth keep the product brand.
function SidebarBrand({
  src,
  label,
  priority,
}: {
  src?: string | null;
  label: string;
  priority?: boolean;
}) {
  // Plain <img>: the source is an auth'd, per-tenant dynamic route, so next/image
  // optimization doesn't apply. Falls back to the Jojan One mark when unset.
  if (src)
    return (
      <img src={src} alt={label} className="max-h-8 w-auto object-contain" />
    );
  return <BrandLogo className="h-7 w-auto" priority={priority} />;
}

function MobileNav({
  pathname,
  allowedModules,
  disabledModules,
  brandLogoSrc,
  workspaceName,
}: {
  pathname: string;
  allowedModules: string[] | null;
  disabledModules?: string[];
  brandLogoSrc?: string | null;
  workspaceName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0">
        <SheetHeader className="flex h-16 flex-row items-center space-y-0 border-b border-sidebar-border px-5">
          <SidebarBrand src={brandLogoSrc} label={workspaceName} />
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <Nav
          pathname={pathname}
          onNavigate={() => setOpen(false)}
          allowedModules={allowedModules}
          disabledModules={disabledModules}
        />
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({
  workspaceName,
  role,
  canWrite,
  allowedModules,
  disabledModules,
  isPlatformAdmin = false,
  brandLogoSrc = null,
  children,
}: {
  workspaceName: string;
  role: string;
  canWrite: boolean;
  allowedModules: string[] | null;
  disabledModules?: string[];
  isPlatformAdmin?: boolean;
  brandLogoSrc?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AccessProvider value={{ canWrite, role, allowedModules }}>
      <div className="flex min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div className="flex h-16 items-center border-b border-sidebar-border px-5">
            <SidebarBrand src={brandLogoSrc} label={workspaceName} priority />
          </div>
          <Nav
            pathname={pathname}
            allowedModules={allowedModules}
            disabledModules={disabledModules}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <MobileNav
                pathname={pathname}
                allowedModules={allowedModules}
                disabledModules={disabledModules}
                brandLogoSrc={brandLogoSrc}
                workspaceName={workspaceName}
              />
              <BrandLogo className="h-6 w-auto md:hidden" />
              <div className="hidden sm:block">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Workspace
                </p>
                <p className="text-sm font-medium text-foreground">
                  {workspaceName}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {role.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
              {!canWrite && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read only
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isPlatformAdmin && (
                <Link
                  href="/admin"
                  className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Admin
                </Link>
              )}
              <ThemeSwitcher
                persist
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              />
              <NotificationBell />
              <SignOutButton />
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto focus:outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </AccessProvider>
  );
}
