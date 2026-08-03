import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { howItWorks } from "@/content/site";
import { Reveal } from "../Reveal";
import { GET_STARTED_HREF } from "../nav";

export const metadata = {
  title: "How It Works - Jojan One",
  description: howItWorks.hero.subheading,
};

export default function HowItWorksPage() {
  const { hero, steps, cta } = howItWorks;

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

      {steps.map((step, index) => (
        <section
          key={step.id}
          id={step.slug}
          className={`s-section ${index % 2 === 1 ? "s-section-lift" : ""}`}
        >
          <div className="s-wrap">
            <div className="s-grid s-grid-2" style={{ marginTop: 0, gap: 48 }}>
              <Reveal>
                <div className="s-step-num">{step.number}</div>
                <p className="s-eyebrow">{step.label}</p>
                <h2 className="s-h2">{step.heading}</h2>
                <p className="s-lead">{step.body}</p>
              </Reveal>

              <Reveal delay={90}>
                <div className="s-card">
                  <p className="s-body">{step.detail}</p>
                  <ul className="s-list" style={{ marginTop: 24 }}>
                    {step.highlights.map((highlight) => (
                      <li key={highlight.id} className="s-check">
                        <Check size={16} />
                        <span>{highlight.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      ))}

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
              <Link href="/capabilities" className="s-btn s-btn-ghost">
                {cta.secondaryLabel}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
