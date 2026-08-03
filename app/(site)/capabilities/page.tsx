import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { capabilities, home } from "@/content/site";
import { Reveal } from "../Reveal";
import { iconFor } from "../icons";
import { GET_STARTED_HREF } from "../nav";

// The count is read from the library rather than written into the copy, so
// the page can never claim a number it does not show.
const COUNT = capabilities.length;

export const metadata = {
  title: "Capabilities - Jojan One",
  description: `Jojan One brings together ${COUNT} integrated capabilities covering compliance, risk, contracts, policies, people, data protection, governance and business intelligence.`,
};

export default function CapabilitiesPage() {
  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Reveal className="s-head">
            <span className="s-pill">Platform</span>
            <h1 className="s-h1">{home.capabilities.headline}</h1>
            <p className="s-lead">
              Jojan One brings together {COUNT} integrated capabilities, each
              one essential, all of them working together to give you a complete
              picture of your business protection.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="s-section s-light s-light-plain">
        <div className="s-wrap">
          <div className="s-cap-grid">
            {capabilities.map((capability, i) => {
              const Icon = iconFor(capability.icon);
              const dark = capability.slug === "jova";
              return (
                <Reveal key={capability.id} delay={(i % 3) * 60}>
                  <Link
                    href={`/capabilities/${capability.slug}`}
                    className={`s-cap-card ${dark ? "s-cap-card-dark" : ""}`}
                  >
                    <span className="s-cap-card-icon">
                      <Icon size={18} />
                    </span>
                    <h2>{capability.name}</h2>
                    <p>{capability.tagline}</p>
                    <span className="s-cap-more">
                      Learn more
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{home.hero.headline}</h2>
            <p className="s-lead">
              All {COUNT} capabilities work together in one platform, giving you
              a single, clear picture of where your business stands.
            </p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                Get Started
                <ArrowRight size={16} />
              </Link>
              <Link href="/pricing" className="s-btn s-btn-ghost">
                View Pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
