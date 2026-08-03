"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MODULES_BY_SECTION } from "@/config/modules.config";
import { planAllowsModule } from "@/shared/plans/entitlements";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  planFeatures = null,
  collapsed = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  allowedModules: string[] | null;
  disabledModules?: string[];
  /** Optional modules the workspace's package includes; null = unrestricted. */
  planFeatures?: string[] | null;
  collapsed?: boolean;
}) {
  const base =
    "flex items-center rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";
  const item = collapsed
    ? `${base} justify-center px-0 py-2`
    : `${base} gap-2.5 px-3 py-2`;
  // A module is listed only when the adviser's scope, the platform
  // kill-switches AND the workspace's package all allow it - so the nav never
  // advertises something the server would refuse.
  const inScope = (key: string) =>
    (!allowedModules ||
      allowedModules.includes(key) ||
      ALWAYS_ALLOWED.has(key)) &&
    (ALWAYS_ALLOWED.has(key) || !disabledModules.includes(key)) &&
    (ALWAYS_ALLOWED.has(key) || planAllowsModule(planFeatures, key));
  return (
    <nav
      aria-label="Quick Navigation"
      className={`flex-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}
    >
      {MODULES_BY_SECTION.map(({ section, items }) => {
        const visible = items.filter((m) => inScope(m.key));
        if (visible.length === 0) return null;
        return (
          <div key={section} className={collapsed ? "mb-3" : "mb-5"}>
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </div>
            )}
            <ul className="space-y-0.5">
              {visible.map((m) => {
                const Icon = m.icon;
                const active = pathname === m.route;
                const implemented = IMPLEMENTED.has(m.route);
                const link = implemented ? (
                  <Link
                    href={m.route}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`${item} ${
                      active
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{m.title}</span>}
                  </Link>
                ) : (
                  <span
                    className={`${item} cursor-not-allowed text-sidebar-foreground/40`}
                    title={collapsed ? undefined : "Coming soon"}
                    aria-disabled="true"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{m.title}</span>
                        <span className="text-[10px] uppercase tracking-wide">
                          soon
                        </span>
                      </>
                    )}
                  </span>
                );
                if (!collapsed) return <li key={m.key}>{link}</li>;
                return (
                  <li key={m.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">
                        {m.title}
                        {!implemented && " · soon"}
                      </TooltipContent>
                    </Tooltip>
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
// otherwise the Jojan One mark. Sidebar-only - landing/auth keep the product brand.
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
  planFeatures,
  brandLogoSrc,
  brandColor,
  workspaceName,
}: {
  pathname: string;
  allowedModules: string[] | null;
  disabledModules?: string[];
  planFeatures?: string[] | null;
  brandLogoSrc?: string | null;
  brandColor?: string | null;
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
      <SheetContent
        side="left"
        className="w-64 bg-sidebar p-0"
        style={brandVars(brandColor)}
      >
        <SheetHeader className="flex h-16 flex-row items-center space-y-0 border-b border-sidebar-border px-5">
          <SidebarBrand src={brandLogoSrc} label={workspaceName} />
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <Nav
          pathname={pathname}
          onNavigate={() => setOpen(false)}
          allowedModules={allowedModules}
          disabledModules={disabledModules}
          planFeatures={planFeatures}
        />
      </SheetContent>
    </Sheet>
  );
}

// Apply the workspace's brand colour by overriding the theme's --primary token
// for everything inside the app shell (buttons, links, accents). Foreground is
// chosen for contrast. No-op for an unset or malformed colour.
function brandVars(hex?: string | null): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex.trim())) return undefined;
  const h = hex.trim();
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    "--primary": h,
    "--primary-foreground": lum > 0.6 ? "#111111" : "#ffffff",
  } as unknown as React.CSSProperties;
}

export function AppShell({
  workspaceName,
  role,
  canWrite,
  allowedModules,
  disabledModules,
  planFeatures = null,
  isPlatformAdmin = false,
  brandLogoSrc = null,
  brandColor = null,
  defaultCollapsed = false,
  children,
}: {
  workspaceName: string;
  role: string;
  canWrite: boolean;
  allowedModules: string[] | null;
  disabledModules?: string[];
  /** Optional modules the package includes; null = unrestricted. */
  planFeatures?: string[] | null;
  isPlatformAdmin?: boolean;
  brandLogoSrc?: string | null;
  brandColor?: string | null;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Persist the choice in a year-long cookie so the layout can render the right
  // width on the server and avoid a hydration flash on the next load.
  const toggleSidebar = () =>
    setCollapsed((v) => {
      const next = !v;
      document.cookie = `jj_sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });

  return (
    <AccessProvider value={{ canWrite, role, allowedModules }}>
      <TooltipProvider delayDuration={0}>
        <div
          className="flex min-h-screen bg-background"
          style={brandVars(brandColor)}
        >
          <a
            href="#main-content"
            className="sr-only z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          <aside
            className={`hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex ${
              collapsed ? "w-16" : "w-64"
            }`}
          >
            <div
              className={`flex h-16 items-center border-b border-sidebar-border ${
                collapsed ? "justify-center px-2" : "justify-between px-5"
              }`}
            >
              {!collapsed && (
                <SidebarBrand
                  src={brandLogoSrc}
                  label={workspaceName}
                  priority
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    aria-label={
                      collapsed ? "Expand sidebar" : "Collapse sidebar"
                    }
                    aria-expanded={!collapsed}
                    className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  >
                    {collapsed ? (
                      <PanelLeftOpen className="h-5 w-5" />
                    ) : (
                      <PanelLeftClose className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                </TooltipContent>
              </Tooltip>
            </div>
            <Nav
              pathname={pathname}
              allowedModules={allowedModules}
              disabledModules={disabledModules}
              planFeatures={planFeatures}
              collapsed={collapsed}
            />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <MobileNav
                  pathname={pathname}
                  allowedModules={allowedModules}
                  disabledModules={disabledModules}
                  planFeatures={planFeatures}
                  brandLogoSrc={brandLogoSrc}
                  brandColor={brandColor}
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
      </TooltipProvider>
    </AccessProvider>
  );
}
