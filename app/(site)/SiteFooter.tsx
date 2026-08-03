import Link from "next/link";
import Image from "next/image";
import { FOOTER_NAV, GET_STARTED_HREF } from "./nav";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="s-footer">
      <div className="s-wrap">
        <div className="s-footer-cols">
          <div>
            <Link href="/" className="s-brand" aria-label="Jojan One home">
              <Image
                src="/assets/logo-header.png"
                alt=""
                width={680}
                height={210}
                style={{ height: 28, width: "auto" }}
              />
            </Link>
            <p className="s-small" style={{ marginTop: 18, maxWidth: 280 }}>
              The Business Protection Operating System for small and
              medium-sized businesses. Understand what matters, take action,
              keep the evidence.
            </p>
            <Link
              href={GET_STARTED_HREF}
              className="s-btn s-btn-primary s-btn-sm"
              style={{ marginTop: 22 }}
            >
              Get Started
            </Link>
          </div>

          {FOOTER_NAV.map((col) => (
            <div key={col.heading}>
              <h3>{col.heading}</h3>
              <ul>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="s-footer-base">
          <span>
            &copy; {year} Jojan One Technologies Ltd. All rights reserved.
          </span>
          <span>
            <Link href="/contact" className="s-link">
              Contact
            </Link>
            {" · "}
            <Link href="/trust/privacy" className="s-link">
              Privacy
            </Link>
            {" · "}
            <Link href="/trust/terms" className="s-link">
              Terms
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
