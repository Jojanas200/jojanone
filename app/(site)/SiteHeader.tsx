"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { GET_STARTED_HREF, PRIMARY_NAV, SIGN_IN_HREF } from "./nav";

export function SiteHeader() {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Route change closes the drawer; without this it survives navigation.
  useEffect(() => setOpen(false), [pathname]);

  const current = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined;

  return (
    <header className={`s-header ${stuck ? "is-stuck" : ""}`}>
      <div className="s-wrap">
        <div className="s-header-bar">
          <Link href="/" className="s-brand" aria-label="Jojan One home">
            <Image
              src="/assets/logo-header.png"
              alt=""
              width={680}
              height={210}
              priority
              style={{ height: 30, width: "auto" }}
            />
          </Link>

          <nav className="s-nav" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current(item.href)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="s-header-cta">
            <Link href={SIGN_IN_HREF} className="s-btn s-btn-ghost s-btn-sm">
              Sign In
            </Link>
            <Link
              href={GET_STARTED_HREF}
              className="s-btn s-btn-primary s-btn-sm"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="s-burger"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open ? (
          <nav className="s-mobile" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current(item.href)}
              >
                {item.label}
              </Link>
            ))}
            <div className="s-mobile-cta">
              <Link href={SIGN_IN_HREF} className="s-btn s-btn-ghost">
                Sign In
              </Link>
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                Get Started
              </Link>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
