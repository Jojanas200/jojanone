import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { help, siteHref } from "@/content/site";
import { Reveal } from "../Reveal";

export const metadata = {
  title: "Help Centre - Jojan One",
  description: help.hero.subheading,
};

export default function HelpPage() {
  const { hero, categories, popular, contact } = help;

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Reveal className="s-head">
            <p className="s-eyebrow">{hero.eyebrow}</p>
            <h1 className="s-h1">{hero.heading}</h1>
            <p className="s-lead">{hero.subheading}</p>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <div className="s-grid s-grid-4" style={{ marginTop: 0 }}>
            {categories.map((category, i) => (
              <Reveal key={category.id} delay={(i % 4) * 60}>
                <Link
                  href={siteHref(category.href)}
                  className="s-card s-card-link"
                  style={{ height: "100%" }}
                >
                  <h2 className="s-h4" style={{ marginBottom: 10 }}>
                    {category.title}
                  </h2>
                  <p className="s-small">{category.description}</p>
                  <span
                    className="s-link-blue"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 18,
                      fontSize: 14,
                    }}
                  >
                    {category.cta}
                    <ChevronRight size={14} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{popular.heading}</h2>
          </Reveal>
          <div className="s-grid s-grid-2">
            {popular.items.map((item, i) => (
              <Reveal key={item.id} delay={(i % 2) * 60}>
                <Link
                  href={siteHref(item.href)}
                  className="s-card s-card-link"
                  style={{ height: "100%" }}
                >
                  <span className="s-tag">{item.category}</span>
                  <h3 className="s-h4" style={{ margin: "14px 0 8px" }}>
                    {item.title}
                  </h3>
                  <p className="s-small">{item.readTime}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{contact.heading}</h2>
            <p className="s-lead">{contact.subheading}</p>
            <div className="s-actions">
              <a href={contact.emailHref} className="s-btn s-btn-primary">
                <Mail size={16} />
                {contact.emailLabel}
              </a>
              <Link href="/contact" className="s-btn s-btn-ghost">
                Contact us
              </Link>
            </div>
            <p className="s-small" style={{ marginTop: 18 }}>
              {contact.note}
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
