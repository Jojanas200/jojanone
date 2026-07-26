"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/health", label: "Health" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="flex gap-1 border-b border-border px-6">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${
            isActive(t.href)
              ? "border-foreground font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
