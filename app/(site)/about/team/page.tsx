import Image from "next/image";
import { Linkedin } from "lucide-react";
import { founder, team } from "@/content/site";
import { Reveal } from "../../Reveal";

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
          <Reveal className="s-head s-head-center">
            <span className="s-pill">{hero.eyebrow}</span>
            <h1 className="s-h1">{hero.title}</h1>
            <p className="s-lead">{hero.subtitle}</p>
          </Reveal>
        </div>
      </section>

      <section className="s-section s-light">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">Leadership</h2>
          </Reveal>

          <div className="s-people">
            {leadership.map((person, i) => (
              <Reveal key={person.id} delay={i * 80}>
                <article className="s-person">
                  <div className="s-person-top">
                    {person.photo ? (
                      <Image
                        src={person.photo}
                        alt={person.name}
                        width={224}
                        height={224}
                        className="s-person-avatar"
                      />
                    ) : null}
                    <div>
                      <h3 className="s-person-name">{person.name}</h3>
                      <p className="s-person-role">{person.role}</p>
                    </div>
                    <a
                      href={person.linkedin}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="s-person-li"
                      aria-label={`${person.name} on LinkedIn`}
                    >
                      <Linkedin size={16} />
                    </a>
                  </div>
                  <p className="s-person-area">{person.area}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <span className="s-quote-rule" />
            <blockquote className="s-quote">
              &ldquo;{founder.hero.tagline}&rdquo;
            </blockquote>
            <p className="s-quote-by">
              &ndash; {founder.hero.name}, Founder &amp; CEO
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
