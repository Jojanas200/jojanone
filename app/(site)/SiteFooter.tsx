import Link from "next/link";
import Image from "next/image";
import { Linkedin } from "lucide-react";
import { FOOTER_NAV, SOCIAL_LINKS } from "./nav";

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
            <p className="s-small" style={{ marginTop: 20, maxWidth: 250 }}>
              The Business Protection Operating System for SMEs.
            </p>
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

        <div className="s-follow">
          <div>
            <h3
              style={{
                textTransform: "none",
                letterSpacing: 0,
                fontSize: 15,
              }}
            >
              Follow Jojan One
            </h3>
            <p className="s-small" style={{ maxWidth: 380 }}>
              Stay connected for product updates, compliance insights, AI
              innovation and business protection resources.
            </p>
          </div>
          <div className="s-socials">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={social.label}
              >
                <Linkedin size={18} />
              </a>
            ))}
          </div>
        </div>

        <div className="s-footer-base">
          <span>
            &copy; {year} Jojan One Technologies Ltd. All rights reserved.
          </span>
          <span>
            <Link href="/trust/cookies" className="s-link">
              Cookie Policy
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
