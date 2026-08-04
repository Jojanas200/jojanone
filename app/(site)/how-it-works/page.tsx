import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  FileCheck,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { howItWorks } from "@/content/site";
import { Reveal } from "../Reveal";
import { GET_STARTED_HREF } from "../nav";

export const metadata = {
  title: "How It Works - Jojan One",
  description: howItWorks.hero.subheading,
};

/**
 * The five stages each own a colour and an icon. They belong to the design
 * rather than to the copy, so they live here keyed by the content's slug
 * instead of being written into the JSON.
 */
const STAGE: Record<string, { colour: string; icon: LucideIcon }> = {
  understand: { colour: "#0866F5", icon: Shield },
  monitor: { colour: "#14B8A6", icon: Activity },
  act: { colour: "#8B5CF6", icon: Zap },
  evidence: { colour: "#F59E0B", icon: FileCheck },
  prove: { colour: "#22C55E", icon: BarChart3 },
};

const stageStyle = (slug: string) =>
  ({
    "--stage": STAGE[slug]?.colour ?? "#0866F5",
  }) as React.CSSProperties;

export default function HowItWorksPage() {
  const { hero, steps, cta } = howItWorks;

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Reveal className="s-head s-head-center">
            <p
              className="s-eyebrow"
              style={{
                letterSpacing: 0,
                fontSize: 15,
                textTransform: "none",
                marginBottom: 20,
              }}
            >
              {hero.eyebrow}
            </p>
            <h1 className="s-h1">{hero.heading}</h1>
            <p className="s-lead">{hero.subheading}</p>
          </Reveal>

          <Reveal delay={100}>
            <div className="s-stage-chips">
              {steps.map((step) => (
                <a
                  key={step.id}
                  href={`#${step.slug}`}
                  className="s-stage-chip"
                  style={stageStyle(step.slug)}
                >
                  <b>{step.number}</b>
                  {step.label}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="s-section" style={{ paddingTop: 0 }}>
        <div className="s-wrap">
          <div className="s-stages">
            {steps.map((step) => {
              const Icon = STAGE[step.slug]?.icon ?? Shield;
              return (
                <Reveal key={step.id}>
                  <article
                    id={step.slug}
                    className="s-stage"
                    style={stageStyle(step.slug)}
                  >
                    <div className="s-stage-mark">
                      <span className="s-stage-icon">
                        <Icon size={26} />
                      </span>
                      <span className="s-stage-num">{step.number}</span>
                    </div>

                    <div>
                      <p className="s-stage-label">{step.label}</p>
                      <h2>{step.heading}</h2>
                      <p className="s-stage-body">{step.body}</p>
                      <p className="s-stage-detail">{step.detail}</p>
                      <ul className="s-stage-list">
                        {step.highlights.map((highlight) => (
                          <li key={highlight.id}>
                            <Check size={16} />
                            <span>{highlight.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
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
