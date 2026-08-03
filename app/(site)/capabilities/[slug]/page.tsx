import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
    description: capability.description,
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

  // The library reads as an ordered sequence, so each page offers its
  // neighbours rather than an arbitrary "related" selection.
  const index = capabilities.findIndex((c) => c.slug === capability.slug);
  const prev = index > 0 ? capabilities[index - 1] : null;
  const next = index < capabilities.length - 1 ? capabilities[index + 1] : null;

  // Each capability declares its own accent; the page follows it throughout.
  const accent = { "--accent": capability.color } as React.CSSProperties;

  return (
    <div className="s-cap" style={accent}>
      <section className="s-cap-hero">
        <div className="s-wrap">
          <nav className="s-crumb" aria-label="Breadcrumb">
            <Link href="/capabilities">
              <ArrowLeft size={14} />
              Capabilities
            </Link>
            <span className="s-crumb-sep">/</span>
            <span className="s-crumb-here">{capability.name}</span>
          </nav>

          <Reveal className="s-head">
            <span className="s-cap-icon">
              <Icon size={26} />
            </span>
            <h1 className="s-h1">{capability.name}</h1>
            <p className="s-cap-tagline">{capability.tagline}</p>
            <p className="s-lead" style={{ marginTop: 0 }}>
              {capability.description}
            </p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-accent">
                Get Started
                <ArrowRight size={15} />
              </Link>
              <Link href="/capabilities" className="s-btn s-btn-ghost">
                All Capabilities
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="s-section s-light">
        <div className="s-wrap">
          <Reveal>
            <h2 className="s-h2">What&rsquo;s included</h2>
          </Reveal>

          <div className="s-grid s-grid-2">
            {capability.features.map((feature, i) => (
              <Reveal key={feature.id} delay={(i % 2) * 70}>
                <div className="s-cap-feature">
                  <span className="s-cap-feature-icon">
                    <Icon size={16} />
                  </span>
                  <h3
                    className="s-h4"
                    style={{
                      fontFamily: "var(--s-sans)",
                      fontSize: 16,
                      fontWeight: 500,
                      marginBottom: 8,
                    }}
                  >
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
        <div className="s-wrap">
          <div className="s-hero-grid">
            <Reveal>
              <h2 className="s-h2">Why it matters</h2>
              <p className="s-body" style={{ marginTop: 16 }}>
                {capability.name} is part of the Jojan One Business Protection
                Operating System, working alongside every other capability to
                give you a complete picture of where your business stands.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <div className="s-benefits">
                {capability.benefits.map((benefit) => (
                  <div key={benefit.id} className="s-benefit">
                    <span className="s-benefit-mark" />
                    <span>{benefit.text}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="s-section s-light">
        <div className="s-wrap s-wrap-narrow" style={{ textAlign: "center" }}>
          <Reveal>
            <h2 className="s-h2">Ready to protect your business?</h2>
            <p className="s-body" style={{ marginTop: 16 }}>
              {capability.name} is available as part of Jojan One, the complete
              Business Protection Operating System for SMEs.
            </p>
            <div className="s-actions" style={{ justifyContent: "center" }}>
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                Get Started
                <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="s-btn s-btn-ghost">
                View Pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {prev || next ? (
        <section className="s-light s-light-plain">
          <div className="s-wrap">
            <div className="s-prevnext">
              {prev ? (
                <Link href={`/capabilities/${prev.slug}`}>
                  <ArrowLeft size={14} />
                  {prev.name}
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={`/capabilities/${next.slug}`}>
                  {next.name}
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <span />
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
