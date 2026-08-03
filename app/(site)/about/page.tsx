import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { about } from "@/content/site";
import { Reveal } from "../Reveal";
import { GET_STARTED_HREF } from "../nav";

export const metadata = {
  title: "About - Jojan One",
  description: about.hero.subtitle,
};

const CHAPTERS = [
  {
    href: "/about/story",
    title: "Our Story",
    body: "How Jojan One came to be, and the problem it was built to solve.",
  },
  {
    href: "/about/founder",
    title: "Founder",
    body: "Anastasia Ayivor on why small businesses deserve better protection.",
  },
  {
    href: "/about/team",
    title: "Leadership & Team",
    body: "The people building the platform.",
  },
];

export default function AboutPage() {
  const { hero, mission, vision, values, cta } = about;

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
          <div className="s-grid s-grid-2" style={{ marginTop: 0, gap: 48 }}>
            <Reveal>
              <p className="s-eyebrow">{mission.eyebrow}</p>
              <h2 className="s-h2">{mission.title}</h2>
            </Reveal>
            <Reveal delay={90}>
              <div style={{ display: "grid", gap: 18 }}>
                {mission.body.map((paragraph) => (
                  <p key={paragraph.id} className="s-body">
                    {paragraph.text}
                  </p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <div className="s-grid s-grid-2" style={{ marginTop: 0, gap: 48 }}>
            <Reveal>
              <p className="s-eyebrow">{vision.eyebrow}</p>
              <h2 className="s-h2">{vision.title}</h2>
            </Reveal>
            <Reveal delay={90}>
              <p className="s-body">{vision.body}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head">
            <p className="s-eyebrow">{values.eyebrow}</p>
            <h2 className="s-h2">{values.title}</h2>
          </Reveal>
          <div className="s-grid s-grid-4">
            {values.items.map((value, i) => (
              <Reveal key={value.id} delay={i * 70}>
                <div className="s-card" style={{ height: "100%" }}>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {value.name}
                  </h3>
                  <p className="s-small">{value.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <div className="s-grid s-grid-3" style={{ marginTop: 0 }}>
            {CHAPTERS.map((chapter, i) => (
              <Reveal key={chapter.href} delay={i * 70}>
                <Link
                  href={chapter.href}
                  className="s-card s-card-link"
                  style={{ height: "100%" }}
                >
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {chapter.title}
                  </h3>
                  <p className="s-small">{chapter.body}</p>
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
                    Read more
                    <ChevronRight size={14} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{cta.title}</h2>
            <p className="s-lead">{cta.subtitle}</p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                {cta.primaryCta}
                <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="s-btn s-btn-ghost">
                {cta.secondaryCta}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
