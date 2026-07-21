import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Search,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { MODULES_BY_SECTION } from "@/config/modules.config";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/core/GlobalSearch";
import { NotificationsPopover } from "@/components/core/NotificationsPopover";
import { BrandLogo } from "@/components/core/BrandLogo";
import { BrandTheme } from "@/components/core/BrandTheme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2">
      <BrandLogo variant="header" />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Jojan One
      </span>
    </Link>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-6 px-3 py-6">
      {MODULES_BY_SECTION.map(({ section, items }) => (
        <div key={section} className="flex flex-col gap-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section}
            </div>
          )}
          {items.map((m) => {
            const active = pathname === m.route;
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                to={m.route}
                onClick={onNavigate}
                title={collapsed ? m.title : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
                  active
                    ? "bg-accent text-primary"
                    : "text-foreground/80 hover:bg-[oklch(0.97_0.005_260)] hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />
                )}
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                {!collapsed && <span className="truncate">{m.title}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const focusPrimaryContact = () => {
    setTimeout(() => {
      const el = document.getElementById("primary-contact");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        (el as HTMLElement).focus();
      }
    }, 60);
  };

  const goProfile = () => {
    if (pathname === "/settings") {
      focusPrimaryContact();
      return;
    }
    navigate({ to: "/settings", search: { section: "business" } }).then(focusPrimaryContact);
  };

  const goSettings = () => {
    if (pathname === "/settings") return;
    navigate({ to: "/settings", search: {} });
  };

  const goBilling = () => {
    navigate({ to: "/settings", search: { section: "billing" } });
  };

  const sidebarWidth = collapsed ? "lg:w-16" : "lg:w-60";
  const mainOffset = collapsed ? "lg:pl-16" : "lg:pl-60";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrandTheme />
      {/* Top nav */}
      <header
        className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border backdrop-blur"
        style={{ background: "var(--surface-topbar)" }}
      >
        <div className="flex h-full items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-foreground hover:bg-[oklch(0.97_0.005_260)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:flex lg:w-60 lg:items-center">
            <Logo />
          </div>
          <div className="lg:hidden">
            <Logo />
          </div>

          {/* Search */}
          <div className="ml-2 hidden flex-1 md:flex md:max-w-xl">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <button
              type="button"
              aria-label="Search"
              className="grid h-9 w-9 place-items-center rounded-md text-foreground hover:bg-[oklch(0.97_0.005_260)] md:hidden"
            >
              <Search className="h-5 w-5" />
            </button>
            <NotificationsPopover />
            <DropdownMenu>
              <DropdownMenuTrigger
                ref={avatarRef}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[oklch(0.97_0.005_260)]"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-[13px] font-medium text-primary-foreground">
                    JO
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  avatarRef.current?.focus();
                }}
              >
                <DropdownMenuItem onSelect={goProfile}>Profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={goSettings}>Settings</DropdownMenuItem>
                <DropdownMenuItem onSelect={goBilling}>Plans &amp; Billing</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out unavailable in this prototype</DialogTitle>
            <DialogDescription>
              Jojan One is currently using a local demonstration session. Secure sign-in and logout will be enabled when production authentication is connected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>Close</Button>
            <Button
              onClick={() => {
                setLogoutOpen(false);
                navigate({ to: "/settings", search: { section: "system" } });
              }}
            >
              View System Information
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 bottom-0 z-30 hidden border-r border-border transition-all lg:block",
          sidebarWidth,
        )}
        style={{ background: "var(--surface-sidebar)" }}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex-1">
            <SidebarContent collapsed={collapsed} />
          </div>
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted-foreground hover:bg-[oklch(0.97_0.005_260)]"
            >
              <Menu className="h-4 w-4" />
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] border-r border-border bg-background shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md hover:bg-[oklch(0.97_0.005_260)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto">
              <SidebarContent
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className={cn("pt-16 transition-all", mainOffset)}>{children}</main>
    </div>
  );
}