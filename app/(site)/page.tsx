import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { capabilityHrefByName, home, siteHref } from "@/content/site";
import { Reveal } from "./Reveal";
import { GET_STARTED_HREF } from "./nav";

export const metadata = {
  title: "Jojan One - Protect your business. Prove it.",
  description: home.hero.body,
};

const CIRCUMFERENCE = 2 * Math.PI * 110;

export default function HomePage() {
  const {
    hero,
    businessConfidence,
    jova,
    howItWorks,
    capabilities,
    documentGeneration,
    executiveIntelligence,
    builtFor,
    trust,
    finalCta,
  } = home;

  const dash = CIRCUMFERENCE - (businessConfidence.score / 100) * CIRCUMFERENCE;

  return (
    <>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="s-hero">
        <div className="s-wrap">
          <Reveal>
            <p className="s-eyebrow">{hero.eyebrow}</p>
            <h1 className="s-h1" style={{ maxWidth: 860 }}>
              {hero.headline}
            </h1>
            <p className="s-lead" style={{ maxWidth: 640 }}>
              {hero.body}
            </p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                {hero.ctaPrimary}
                <ArrowRight size={16} />
              </Link>
              <Link href="/how-it-works" className="s-btn s-btn-ghost">
                {hero.ctaSecondary}
              </Link>
            </div>
            <p className="s-hero-note">{hero.ctaSupporting}</p>
          </Reveal>
        </div>
      </section>

      {/* ---- Business Confidence Score ------------------------------- */}
      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{businessConfidence.headline}</h2>
            <p className="s-lead">{businessConfidence.body}</p>
          </Reveal>

          <div className="s-score">
            <Reveal>
              <div className="s-dial">
                <svg viewBox="0 0 240 240" aria-hidden="true">
                  <circle
                    cx="120"
                    cy="120"
                    r="110"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="110"
                    fill="none"
                    stroke="url(#scoreArc)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dash}
                  />
                  <defs>
                    <linearGradient id="scoreArc" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#0866F5" />
                      <stop offset="100%" stopColor="#14B8A6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="s-dial-value">
                  <span className="s-dial-num">{businessConfidence.score}</span>
                  <span className="s-dial-label">
                    {businessConfidence.scoreLabel}
                  </span>
                </div>
              </div>
              <p
                className="s-small"
                style={{ textAlign: "center", marginTop: 12 }}
              >
                Illustrative score. Yours is calculated from your own records.
              </p>
            </Reveal>

            <div className="s-meters">
              {businessConfidence.modules.map((module, i) => (
                <Reveal key={module.id} delay={i * 60}>
                  <div className="s-meter-top">
                    <span>{module.name}</span>
                    <span>{module.score}</span>
                  </div>
                  <div className="s-meter-track">
                    <div
                      className="s-meter-fill"
                      style={{ width: `${module.score}%` }}
                    />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Jova ---------------------------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{jova.headline}</h2>
            <p className="s-lead">{jova.subheadline}</p>
          </Reveal>

          <div className="s-jova">
            <Reveal>
              <div className="s-list">
                {jova.alerts.map((alert) => (
                  <div key={alert.id} className="s-alert">
                    <span className={`s-dot s-dot-${alert.severity}`} />
                    <span>
                      <span style={{ display: "block", marginBottom: 6 }}>
                        {alert.title}
                      </span>
                      <span className="s-small">{alert.tag}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="s-chat">
                <p className="s-chat-q">&ldquo;{jova.userQuery}&rdquo;</p>
                <dl className="s-chat-a">
                  <div>
                    <dt>What</dt>
                    <dd>{jova.jovaResponse.what}</dd>
                  </div>
                  <div>
                    <dt>Why it matters</dt>
                    <dd>{jova.jovaResponse.why}</dd>
                  </div>
                  <div>
                    <dt>What to do</dt>
                    <dd>{jova.jovaResponse.action}</dd>
                  </div>
                </dl>
                <p className="s-chat-src">{jova.jovaResponse.source}</p>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="s-actions">
              <Link href="/capabilities/jova" className="s-btn s-btn-ghost">
                More about Jova
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- How it works -------------------------------------------- */}
      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{howItWorks.headline}</h2>
            <p className="s-lead">{howItWorks.body}</p>
          </Reveal>

          <div className="s-steps">
            {howItWorks.steps.map((step, i) => (
              <Reveal key={step.id} delay={i * 70}>
                <div className="s-card" style={{ height: "100%" }}>
                  <div className="s-step-num">{step.number}</div>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {step.name}
                  </h3>
                  <p className="s-small">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="s-actions">
              <Link href="/how-it-works" className="s-btn s-btn-ghost">
                See how it works in detail
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Capabilities -------------------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{capabilities.headline}</h2>
          </Reveal>

          <div className="s-grid s-grid-3">
            {capabilities.items.map((item, i) => {
              const href = capabilityHrefByName(item.name);
              const body = (
                <>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {item.name}
                  </h3>
                  <p className="s-small">{item.description}</p>
                </>
              );
              return (
                <Reveal key={item.id} delay={(i % 3) * 70}>
                  {href ? (
                    <Link
                      href={href}
                      className="s-card s-card-link"
                      style={{ height: "100%" }}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="s-card" style={{ height: "100%" }}>
                      {body}
                    </div>
                  )}
                </Reveal>
              );
            })}
          </div>

          <Reveal>
            <div className="s-actions">
              <Link href="/capabilities" className="s-btn s-btn-ghost">
                Explore all capabilities
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Document generation ------------------------------------- */}
      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{documentGeneration.headline}</h2>
            <p className="s-lead">{documentGeneration.body}</p>
          </Reveal>

          <Reveal>
            <div className="s-chain">
              {documentGeneration.workflow.map((step, i) => (
                <span
                  key={step.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span className="s-chain-step">{step.step}</span>
                  {i < documentGeneration.workflow.length - 1 ? (
                    <ChevronRight size={16} />
                  ) : null}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal>
            <div className="s-chips">
              {documentGeneration.documentTypes.map((doc) => (
                <span key={doc.id} className="s-chip">
                  {doc.name}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal>
            <div className="s-actions">
              <Link
                href="/capabilities/document-generation"
                className="s-btn s-btn-ghost"
              >
                More about document generation
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Executive intelligence ---------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{executiveIntelligence.headline}</h2>
            <p className="s-lead">{executiveIntelligence.body}</p>
            <div className="s-actions">
              <Link
                href="/capabilities/executive-intelligence"
                className="s-btn s-btn-ghost"
              >
                See Executive Intelligence
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Built for ----------------------------------------------- */}
      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{builtFor.headline}</h2>
          </Reveal>

          <div className="s-grid s-grid-4">
            {builtFor.segments.map((segment, i) => (
              <Reveal key={segment.id} delay={i * 70}>
                <div className="s-card" style={{ height: "100%" }}>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {segment.name}
                  </h3>
                  <p className="s-small">{segment.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="s-small" style={{ marginTop: 32, maxWidth: 720 }}>
              {builtFor.jurisdictionNote}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---- Trust --------------------------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{trust.headline}</h2>
            <p className="s-lead">{trust.body}</p>
          </Reveal>

          <div className="s-grid s-grid-3">
            {trust.pillars.map((pillar, i) => (
              <Reveal key={pillar.id} delay={(i % 3) * 70}>
                <Link
                  href={siteHref(pillar.href)}
                  className="s-card s-card-link"
                  style={{ height: "100%" }}
                >
                  <span className="s-check">
                    <Check size={16} />
                    <span style={{ color: "#fff" }}>{pillar.name}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Final CTA ----------------------------------------------- */}
      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{finalCta.headline}</h2>
            <p className="s-lead">{finalCta.body}</p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                {finalCta.ctaPrimary}
                <ArrowRight size={16} />
              </Link>
              <Link href="/how-it-works" className="s-btn s-btn-ghost">
                {finalCta.ctaSecondary}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
