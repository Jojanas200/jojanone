import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ourStory } from "@/content/site";
import { Reveal } from "../../Reveal";
import { GET_STARTED_HREF } from "../../nav";

export const metadata = {
  title: "Our Story - Jojan One",
  description: ourStory.hero.subtitle,
};

export default function StoryPage() {
  const { hero, chapters, cta } = ourStory;

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
        <div className="s-wrap s-wrap-narrow">
          <div style={{ display: "grid", gap: 40 }}>
            {chapters.map((chapter, i) => (
              <Reveal key={chapter.id} delay={i * 60}>
                <article
                  style={{
                    borderLeft: "1px solid var(--s-line)",
                    paddingLeft: 28,
                  }}
                >
                  <p
                    className="s-eyebrow"
                    style={{ marginBottom: 10, color: "var(--s-blue)" }}
                  >
                    {chapter.year}
                  </p>
                  <h2 className="s-h3" style={{ marginBottom: 14 }}>
                    {chapter.title}
                  </h2>
                  <p className="s-body">{chapter.body}</p>
                </article>
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
              <Link href="/about/founder" className="s-btn s-btn-ghost">
                {cta.secondaryCta}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
