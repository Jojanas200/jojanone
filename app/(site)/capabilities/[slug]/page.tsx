import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { capabilities, capabilityBySlug } from "@/content/site";
import { Reveal } from "../../Reveal";
import { iconFor } from "../../icons";
import { GET_STARTED_HREF } from "../../nav";

export function generateStaticParams() {
  return capabilities.map((capability) => ({ slug: capability.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const capability = capabilityBySlug(slug);
  if (!capability) return { title: "Capability - Jojan One" };
  return {
    title: `${capability.name} - Jojan One`,
    description: capability.tagline,
  };
}

export default async function CapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const capability = capabilityBySlug(slug);
  if (!capability) notFound();

  const Icon = iconFor(capability.icon);
  const others = capabilities
    .filter((c) => c.slug !== capability.slug)
    .slice(0, 3);

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Link href="/capabilities" className="s-back">
            <ArrowLeft size={14} />
            All capabilities
          </Link>
          <Reveal className="s-head">
            <span
              className="s-icon"
              style={{
                background: `${capability.color}1f`,
                color: capability.color,
              }}
            >
              <Icon size={22} />
            </span>
            <h1 className="s-h1">{capability.name}</h1>
            <p className="s-lead">{capability.tagline}</p>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <p className="s-body" style={{ fontSize: 18 }}>
              {capability.description}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <p className="s-eyebrow">What it does</p>
            <h2 className="s-h2">Built around the work, not the checklist.</h2>
          </Reveal>

          <div className="s-grid s-grid-2">
            {capability.features.map((feature, i) => (
              <Reveal key={feature.id} delay={(i % 2) * 70}>
                <div className="s-card" style={{ height: "100%" }}>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {feature.title}
                  </h3>
                  <p className="s-small">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <p className="s-eyebrow">What you get</p>
            <h2 className="s-h2">Why it matters</h2>
            <ul className="s-list" style={{ marginTop: 32 }}>
              {capability.benefits.map((benefit) => (
                <li key={benefit.id} className="s-check">
                  <Check size={16} />
                  <span>{benefit.text}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h3">Explore more</h2>
          </Reveal>
          <div className="s-grid s-grid-3" style={{ marginTop: 32 }}>
            {others.map((other, i) => (
              <Reveal key={other.id} delay={i * 70}>
                <Link
                  href={`/capabilities/${other.slug}`}
                  className="s-card s-card-link"
                  style={{ height: "100%" }}
                >
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {other.name}
                  </h3>
                  <p className="s-small">{other.tagline}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">Know where your business stands.</h2>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                Start Your 14-Day Free Trial
                <ArrowRight size={16} />
              </Link>
              <Link href="/how-it-works" className="s-btn s-btn-ghost">
                See How It Works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
