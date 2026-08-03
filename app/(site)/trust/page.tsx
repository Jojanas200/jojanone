import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { trustCentre } from "@/content/site";
import { Reveal } from "../Reveal";

export const metadata = {
  title: "Trust Centre - Jojan One",
  description: trustCentre.hero.subtitle,
};

export default function TrustCentrePage() {
  const { hero, sections, certifications, contact } = trustCentre;

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Reveal className="s-head">
            <p className="s-eyebrow">{hero.eyebrow}</p>
            <h1 className="s-h1">{hero.title}</h1>
            <p className="s-lead">{hero.subtitle}</p>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <div className="s-grid s-grid-3" style={{ marginTop: 0 }}>
            {sections.map((section, i) => (
              <Reveal key={section.id} delay={(i % 3) * 70}>
                <Link
                  href={section.href}
                  className="s-card s-card-link"
                  style={{ height: "100%" }}
                >
                  {section.badge ? (
                    <span
                      className="s-tag"
                      style={{ marginBottom: 14, display: "inline-block" }}
                    >
                      {section.badge}
                    </span>
                  ) : null}
                  <h2 className="s-h4" style={{ marginBottom: 10 }}>
                    {section.title}
                  </h2>
                  <p className="s-small">{section.description}</p>
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
                    Read
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
            <h2 className="s-h2">{certifications.title}</h2>
            <p className="s-lead">{certifications.note}</p>
          </Reveal>
          <div className="s-grid s-grid-4">
            {certifications.items.map((item, i) => (
              <Reveal key={item.id} delay={i * 60}>
                <div className="s-card" style={{ height: "100%" }}>
                  <h3 className="s-h4" style={{ marginBottom: 8 }}>
                    {item.label}
                  </h3>
                  <p className="s-small">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{contact.title}</h2>
            <p className="s-lead">{contact.body}</p>
            <div className="s-actions">
              <a
                href={`mailto:${contact.email}`}
                className="s-btn s-btn-primary"
              >
                <Mail size={16} />
                {contact.cta}
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
