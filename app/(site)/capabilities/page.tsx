import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { capabilities } from "@/content/site";
import { Reveal } from "../Reveal";
import { iconFor } from "../icons";
import { GET_STARTED_HREF } from "../nav";

export const metadata = {
  title: "Capabilities - Jojan One",
  description:
    "Fifteen capabilities covering compliance, risk, contracts, policies, people, data protection, governance and business intelligence - in one platform.",
};

export default function CapabilitiesPage() {
  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Reveal className="s-head">
            <p className="s-eyebrow">Capabilities</p>
            <h1 className="s-h1">
              Everything your business needs to stay protected.
            </h1>
            <p className="s-lead">
              Each capability works on its own and every one feeds the same
              Business Memory, so what you record in one place is understood
              everywhere else.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <div className="s-grid s-grid-3" style={{ marginTop: 0 }}>
            {capabilities.map((capability, i) => {
              const Icon = iconFor(capability.icon);
              return (
                <Reveal key={capability.id} delay={(i % 3) * 70}>
                  <Link
                    href={`/capabilities/${capability.slug}`}
                    className="s-card s-card-link"
                    style={{ height: "100%" }}
                  >
                    <span
                      className="s-icon"
                      style={{
                        background: `${capability.color}1f`,
                        color: capability.color,
                      }}
                    >
                      <Icon size={20} />
                    </span>
                    <h2 className="s-h4" style={{ marginBottom: 10 }}>
                      {capability.name}
                    </h2>
                    <p className="s-small">{capability.tagline}</p>
                    <span
                      className="s-link-blue"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 18,
                        fontSize: 14,
                      }}
                    >
                      Learn more
                      <ChevronRight size={14} />
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
            <h2 className="s-h2">See it working on your own business.</h2>
            <p className="s-lead">
              Start the 14-day trial and Jojan One begins building your Business
              Memory from the first answer.
            </p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                Start Your 14-Day Free Trial
                <ArrowRight size={16} />
              </Link>
              <Link href="/pricing" className="s-btn s-btn-ghost">
                See pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
