import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Linkedin } from "lucide-react";
import { team } from "@/content/site";
import { Reveal } from "../../Reveal";
import { GET_STARTED_HREF } from "../../nav";

export const metadata = {
  title: "Leadership & Team - Jojan One",
  description: team.hero.subtitle,
};

export default function TeamPage() {
  const { hero, leadership } = team;

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Link href="/about" className="s-back">
            <ArrowLeft size={14} />
            About
          </Link>
          <Reveal className="s-head">
            <p className="s-eyebrow">{hero.eyebrow}</p>
            <h1 className="s-h1">{hero.title}</h1>
            <p className="s-lead">{hero.subtitle}</p>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <div className="s-grid s-grid-2" style={{ marginTop: 0 }}>
            {leadership.map((person, i) => (
              <Reveal key={person.id} delay={i * 80}>
                <div className="s-card" style={{ height: "100%" }}>
                  {person.photo ? (
                    <Image
                      src={person.photo}
                      alt={person.name}
                      width={640}
                      height={640}
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--s-radius)",
                        marginBottom: 22,
                      }}
                    />
                  ) : null}
                  <h2 className="s-h3" style={{ marginBottom: 6 }}>
                    {person.name}
                  </h2>
                  <p
                    style={{ color: "var(--s-teal)", fontSize: 15, margin: 0 }}
                  >
                    {person.role}
                  </p>
                  <p className="s-small" style={{ marginTop: 14 }}>
                    {person.area}
                  </p>
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="s-link-blue"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 20,
                      fontSize: 14,
                    }}
                  >
                    <Linkedin size={14} />
                    LinkedIn
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">Build with us.</h2>
            <p className="s-lead">
              We are a small team solving a problem that affects millions of
              businesses. If that sounds like your kind of work, get in touch.
            </p>
            <div className="s-actions">
              <Link href="/contact" className="s-btn s-btn-primary">
                Contact us
                <ArrowRight size={16} />
              </Link>
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-ghost">
                Start Your 14-Day Free Trial
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
