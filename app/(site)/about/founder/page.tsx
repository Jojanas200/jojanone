import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Linkedin, Mail } from "lucide-react";
import { founder } from "@/content/site";
import { Reveal } from "../../Reveal";
import { GET_STARTED_HREF } from "../../nav";

export const metadata = {
  title: "Founder - Jojan One",
  description: founder.hero.tagline,
};

const LINKEDIN = "https://www.linkedin.com/in/anastasia-ayivor-";
const EMAIL = "hello@jojanone.com";

export default function FounderPage() {
  const { hero, story, beliefs, connect, cta } = founder;

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Link href="/about" className="s-back">
            <ArrowLeft size={14} />
            About
          </Link>

          <div
            className="s-grid s-grid-2"
            style={{ marginTop: 0, gap: 48, alignItems: "center" }}
          >
            <Reveal>
              <p className="s-eyebrow">{hero.eyebrow}</p>
              <h1 className="s-h1">{hero.name}</h1>
              <p className="s-lead" style={{ marginTop: 12 }}>
                {hero.role}
              </p>
              <p
                className="s-body"
                style={{ marginTop: 24, fontSize: 18, color: "#fff" }}
              >
                &ldquo;{hero.tagline}&rdquo;
              </p>
            </Reveal>

            <Reveal delay={90}>
              <Image
                src="/assets/founder.png"
                alt={hero.name}
                width={640}
                height={640}
                style={{
                  width: "100%",
                  maxWidth: 380,
                  height: "auto",
                  borderRadius: "var(--s-radius)",
                  border: "1px solid var(--s-line)",
                }}
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <p className="s-body" style={{ fontSize: 18 }}>
              {hero.bio}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{story.heading}</h2>
            <div style={{ display: "grid", gap: 20, marginTop: 28 }}>
              {story.paragraphs.map((paragraph) => (
                <p key={paragraph.id} className="s-body">
                  {paragraph.text}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{beliefs.heading}</h2>
          </Reveal>
          <div className="s-grid s-grid-3">
            {beliefs.items.map((item, i) => (
              <Reveal key={item.id} delay={i * 70}>
                <div className="s-card" style={{ height: "100%" }}>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {item.heading}
                  </h3>
                  <p className="s-small">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h3">{connect.heading}</h2>
            <p className="s-body" style={{ marginTop: 14 }}>
              {connect.body}
            </p>
            <div className="s-actions">
              <a
                href={LINKEDIN}
                target="_blank"
                rel="noreferrer noopener"
                className="s-btn s-btn-ghost"
              >
                <Linkedin size={16} />
                {connect.linkedinLabel}
              </a>
              <a href={`mailto:${EMAIL}`} className="s-btn s-btn-ghost">
                <Mail size={16} />
                {connect.emailLabel}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{cta.heading}</h2>
            <p className="s-lead">{cta.subheading}</p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                {cta.primaryLabel}
                <ArrowRight size={16} />
              </Link>
              <Link href="/about/team" className="s-btn s-btn-ghost">
                {cta.secondaryLabel}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
