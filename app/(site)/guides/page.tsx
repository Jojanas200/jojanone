import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { guides } from "@/content/site";
import { Reveal } from "../Reveal";
import { GET_STARTED_HREF } from "../nav";
import { GuideGrid } from "./GuideGrid";

export const metadata = {
  title: "Guides & Insights - Jojan One",
  description: guides.hero.subheading,
};

export default function GuidesPage() {
  const { hero, featured, cta } = guides;

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

      <section className="s-section-tight">
        <div className="s-wrap">
          <Reveal>
            <Link
              href="/capabilities/compliance-monitor"
              className="s-card s-card-link"
              style={{ padding: 40 }}
            >
              <p className="s-eyebrow">{featured.eyebrow}</p>
              <h2 className="s-h2" style={{ maxWidth: 720 }}>
                {featured.title}
              </h2>
              <p className="s-lead" style={{ maxWidth: 720 }}>
                {featured.description}
              </p>
              <span
                className="s-link-blue"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 24,
                }}
              >
                {featured.cta}
                <ChevronRight size={15} />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <GuideGrid />
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{cta.heading}</h2>
            <p className="s-lead">{cta.subheading}</p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                {cta.primary}
                <ArrowRight size={16} />
              </Link>
              <Link href="/capabilities" className="s-btn s-btn-ghost">
                {cta.secondary}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
