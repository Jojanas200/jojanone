import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Quote,
  TriangleAlert,
} from "lucide-react";
import {
  capabilityHrefByName,
  capabilityIconByName,
  home,
  siteHref,
} from "@/content/site";
import { Reveal } from "./Reveal";
import { BadgeStrip } from "./BadgeStrip";
import { iconFor } from "./icons";
import { GET_STARTED_HREF } from "./nav";

export const metadata = {
  title: "Jojan One - Protect your business. Prove it.",
  description: home.hero.body,
};

/**
 * The product mockups are a drawing of the interface, not a screenshot: they
 * stay sharp, need no image pipeline, and the figures below are the same
 * illustrative set the rest of the page uses. Nothing here is customer data.
 */
const MOCK = {
  status: [
    { label: "2 Critical", colour: "#f87171" },
    { label: "5 Actions", colour: "#fbbf24" },
    { label: "12 Compliant", colour: "#14b8a6" },
  ],
  delta: "4 points this month",
  evidenceReadiness: 83,
  risks: [
    {
      id: "r1",
      name: "Employment contract gap",
      level: "Critical",
      cls: "s-crit",
      dot: "#dc2626",
    },
    {
      id: "r2",
      name: "GDPR review overdue",
      level: "High",
      cls: "s-high",
      dot: "#d97706",
    },
    {
      id: "r3",
      name: "Supplier agreement expiry",
      level: "Medium",
      cls: "s-med",
      dot: "#0866f5",
    },
  ],
  compliance: [
    { id: "c1", name: "Employment Law", score: 88, colour: "#0866f5" },
    { id: "c2", name: "Data Protection", score: 74, colour: "#d97706" },
    { id: "c3", name: "Health & Safety", score: 95, colour: "#14b8a6" },
    { id: "c4", name: "Financial Conduct", score: 82, colour: "#0866f5" },
  ],
  actions: [
    { id: "a1", name: "Update employment contract template", due: "Today" },
    { id: "a2", name: "Complete GDPR data mapping review", due: "3 days" },
    { id: "a3", name: "Renew supplier agreement, Acme Ltd", due: "21 days" },
  ],
};

function Dial({
  score,
  label,
  size,
  stroke,
  track,
}: {
  score: number;
  label: string;
  size: number;
  stroke: number;
  track: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // The same dial is drawn at 200px, 86px and 54px. Its type has to be a
  // fraction of the ring rather than a fixed size, or the number overflows
  // the smaller two.
  const numSize = Math.round(size * 0.29);
  const labelSize = Math.max(7, Math.round(size * 0.08));

  return (
    <div className="s-dial" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#0866F5"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (score / 100) * circumference}
        />
      </svg>
      <div className="s-dial-value">
        <span className="s-dial-num" style={{ fontSize: numSize }}>
          {score}
        </span>
        {label ? (
          <span
            className="s-dial-label"
            style={{
              fontSize: labelSize,
              marginTop: Math.round(size * 0.03),
              letterSpacing: size < 120 ? "0.08em" : undefined,
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

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

  return (
    <>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="s-hero">
        <div className="s-wrap">
          <div className="s-hero-grid">
            <Reveal>
              <p className="s-pill">{hero.eyebrow}</p>
              <h1 className="s-h1">{hero.headline}</h1>
              <p className="s-lead" style={{ maxWidth: 520 }}>
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

            <Reveal delay={120}>
              <div className="s-window">
                <div className="s-window-bar">
                  <span
                    className="s-window-dot"
                    style={{ background: "#f87171" }}
                  />
                  <span
                    className="s-window-dot"
                    style={{ background: "#fbbf24" }}
                  />
                  <span
                    className="s-window-dot"
                    style={{ background: "#14b8a6" }}
                  />
                  <span className="s-window-title">
                    Jojan One &ndash; Business Protection
                  </span>
                </div>

                <div className="s-window-body">
                  <div className="s-window-top">
                    <div className="s-window-dial">
                      <Dial
                        score={businessConfidence.score}
                        label={businessConfidence.scoreLabel.toUpperCase()}
                        size={86}
                        stroke={6}
                        track="rgba(255,255,255,0.1)"
                      />
                      <p className="s-window-caption">Business Confidence</p>
                    </div>

                    <div style={{ display: "grid", gap: 9 }}>
                      {businessConfidence.modules.slice(0, 6).map((module) => (
                        <div key={module.id} className="s-mini-bar">
                          <span>{module.name}</span>
                          <span className="s-mini-track">
                            <span
                              className={`s-mini-fill ${module.score >= 90 ? "s-mini-fill-teal" : ""}`}
                              style={{
                                width: `${module.score}%`,
                                display: "block",
                              }}
                            />
                          </span>
                          <b>{module.score}</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="s-window-alert">
                    <Brain
                      size={15}
                      style={{ color: "#14b8a6", flexShrink: 0, marginTop: 2 }}
                    />
                    <span>
                      <span style={{ display: "block", marginBottom: 5 }}>
                        <b style={{ color: "#14b8a6", fontWeight: 500 }}>
                          Jova
                        </b>{" "}
                        <span
                          className="s-sev s-sev-high"
                          style={{ marginLeft: 6 }}
                        >
                          Action required
                        </span>
                      </span>
                      <span style={{ color: "var(--s-dim)" }}>
                        {jova.alerts[0].title}
                      </span>
                    </span>
                  </div>

                  <div className="s-window-status">
                    {MOCK.status.map((item) => (
                      <span key={item.label}>
                        <span
                          className="s-window-dot"
                          style={{
                            background: item.colour,
                            width: 7,
                            height: 7,
                          }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---- Business Confidence Score ------------------------------- */}
      <section className="s-section s-light">
        <div className="s-wrap">
          <div className="s-score">
            <Reveal>
              <Dial
                score={businessConfidence.score}
                label={businessConfidence.scoreLabel}
                size={200}
                stroke={12}
                track="#E2E8F0"
              />
              <p className="s-dial-caption">Business Confidence Score</p>
              <p
                className="s-small"
                style={{ textAlign: "center", marginTop: 6 }}
              >
                Illustrative. Yours is calculated from your own records.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <h2 className="s-h2">{businessConfidence.headline}</h2>
              <p className="s-lead">{businessConfidence.body}</p>

              <div className="s-meters">
                {businessConfidence.modules.map((module) => (
                  <div key={module.id} className="s-meter-row">
                    <span>{module.name}</span>
                    <span className="s-meter-track">
                      <span
                        className="s-meter-fill"
                        style={{ width: `${module.score}%`, display: "block" }}
                      />
                    </span>
                    <b>{module.score}</b>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---- Jova ---------------------------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <Reveal className="s-head s-head-center">
            <span className="s-pill s-pill-teal">
              <Brain size={14} />
              Jova
            </span>
            <h2 className="s-h2">{jova.headline}</h2>
            <p className="s-lead">{jova.subheadline}</p>
          </Reveal>

          <div className="s-jova">
            <Reveal>
              <div className="s-panel" style={{ height: "100%" }}>
                <div className="s-panel-head">
                  <span>
                    <span
                      className="s-window-dot"
                      style={{ background: "#14b8a6", width: 8, height: 8 }}
                    />
                    Jova Intelligence
                  </span>
                  <span className="s-panel-count">
                    {jova.alerts.length} items
                  </span>
                </div>
                <div className="s-panel-body">
                  {jova.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`s-alert s-alert-${alert.severity}`}
                    >
                      <span className="s-alert-top">
                        <span>{alert.title}</span>
                        <span className={`s-sev s-sev-${alert.severity}`}>
                          {alert.severity === "high"
                            ? "High"
                            : alert.severity === "medium"
                              ? "Medium"
                              : "Low"}
                        </span>
                      </span>
                      <span className="s-alert-tag">{alert.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="s-panel" style={{ height: "100%" }}>
                <div className="s-panel-head">
                  <span>
                    <Brain size={15} style={{ color: "#14b8a6" }} />
                    Jova Analysis
                  </span>
                </div>
                <div className="s-panel-body">
                  <div className="s-ask">
                    <p className="s-ask-label">Your question</p>
                    <p className="s-ask-q">{jova.userQuery}</p>
                  </div>

                  <dl className="s-answer">
                    <div>
                      <FileText size={16} />
                      <div>
                        <dt>What happened</dt>
                        <dd>{jova.jovaResponse.what}</dd>
                      </div>
                    </div>
                    <div>
                      <TriangleAlert size={16} />
                      <div>
                        <dt>Why it matters</dt>
                        <dd>{jova.jovaResponse.why}</dd>
                      </div>
                    </div>
                    <div>
                      <CheckCircle2 size={16} />
                      <div>
                        <dt>What to do</dt>
                        <dd>{jova.jovaResponse.action}</dd>
                      </div>
                    </div>
                    <div>
                      <Quote size={16} />
                      <div>
                        <dt>Source</dt>
                        <dd className="s-answer-src">
                          {jova.jovaResponse.source}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="s-actions" style={{ justifyContent: "center" }}>
              <Link href="/capabilities/jova" className="s-btn s-btn-ghost">
                More about Jova
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- How it works -------------------------------------------- */}
      <section className="s-section s-light">
        <div className="s-wrap">
          <Reveal className="s-head s-head-center">
            <h2 className="s-h2">{howItWorks.headline}</h2>
            <p className="s-lead">{howItWorks.body}</p>
          </Reveal>

          <div className="s-stepper">
            {howItWorks.steps.map((step, i) => (
              <Reveal
                key={step.id}
                delay={i * 80}
                className={`s-step ${i === 0 ? "s-step-first" : ""}`}
              >
                <div className="s-step-num">{step.number}</div>
                <h3>{step.name}</h3>
                <p className="s-small">{step.description}</p>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="s-actions" style={{ justifyContent: "center" }}>
              <Link href="/how-it-works" className="s-btn s-btn-ghost">
                See how it works in detail
                <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Capabilities -------------------------------------------- */}
      <section className="s-section s-light s-light-plain">
        <div className="s-wrap">
          <Reveal className="s-head">
            <h2 className="s-h2">{capabilities.headline}</h2>
          </Reveal>

          <div className="s-bento">
            {capabilities.items.map((item, i) => {
              const href = capabilityHrefByName(item.name);
              const Icon = iconFor(capabilityIconByName(item.name));
              const dark = item.name === "Jova";
              const classes = [
                "s-card",
                "s-card-link",
                item.size === "large" ? "s-bento-wide" : "",
                dark ? "s-bento-dark" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <Reveal key={item.id} delay={(i % 4) * 60}>
                  <Link
                    href={href ?? "/capabilities"}
                    className={classes}
                    style={{ height: "100%" }}
                  >
                    <span
                      className="s-icon"
                      style={
                        dark
                          ? {
                              background: "rgba(20,184,166,0.12)",
                              color: "#14b8a6",
                              marginBottom: 14,
                            }
                          : { marginBottom: 14 }
                      }
                    >
                      <Icon size={18} />
                    </span>
                    <h3 className="s-h4" style={{ marginBottom: 10 }}>
                      {item.name}
                    </h3>
                    <p className="s-small">{item.description}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Document generation ------------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <div className="s-hero-grid">
            <Reveal>
              <h2 className="s-h2">{documentGeneration.headline}</h2>
              <p className="s-lead" style={{ maxWidth: 520 }}>
                {documentGeneration.body}
              </p>

              <div className="s-chain">
                {documentGeneration.workflow.map((step, i) => (
                  <span
                    key={step.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span className="s-chain-step">{step.step}</span>
                    {i < documentGeneration.workflow.length - 1 ? (
                      <ChevronRight size={14} />
                    ) : null}
                  </span>
                ))}
              </div>

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

            <Reveal delay={110}>
              <div className="s-window">
                <div
                  className="s-window-bar"
                  style={{ justifyContent: "space-between" }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 9,
                      fontSize: 13,
                      color: "#fff",
                      fontWeight: 500,
                    }}
                  >
                    <FileText size={15} style={{ color: "#0866f5" }} />
                    Document Library
                  </span>
                  <span className="s-window-title" style={{ marginLeft: 0 }}>
                    Jurisdiction-aware
                  </span>
                </div>
                <div className="s-doclib">
                  {documentGeneration.documentTypes.map((doc) => (
                    <div key={doc.id} className="s-doclib-row">
                      <FileText size={15} />
                      <span>{doc.name}</span>
                      <span className="s-ready">Ready</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---- Executive intelligence ---------------------------------- */}
      <section className="s-section s-light">
        <div className="s-wrap">
          <div className="s-hero-grid">
            <Reveal>
              <h2 className="s-h2">{executiveIntelligence.headline}</h2>
              <p className="s-lead" style={{ maxWidth: 520 }}>
                {executiveIntelligence.body}
              </p>
              <p style={{ marginTop: 32 }}>
                <Link
                  href="/capabilities/executive-intelligence"
                  className="s-link-blue"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Explore Executive Intelligence
                  <ArrowRight size={15} />
                </Link>
              </p>
            </Reveal>

            <Reveal delay={110}>
              <div className="s-exec">
                <div className="s-exec-bar">
                  <span>
                    <span
                      className="s-window-dot"
                      style={{ background: "#14b8a6", width: 8, height: 8 }}
                    />
                    Executive Intelligence
                  </span>
                  <em>Live &middot; Updated now</em>
                </div>

                <div className="s-exec-body">
                  <div className="s-exec-summary">
                    <Dial
                      score={businessConfidence.score}
                      label=""
                      size={54}
                      stroke={5}
                      track="#E2E8F0"
                    />
                    <div>
                      <p className="s-small" style={{ marginBottom: 2 }}>
                        Business Confidence
                      </p>
                      <p style={{ margin: 0, fontSize: 19, fontWeight: 500 }}>
                        {businessConfidence.scoreLabel}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 12,
                          color: "#14b8a6",
                        }}
                      >
                        &uarr; {MOCK.delta}
                      </p>
                    </div>
                    <div>
                      <p className="s-small" style={{ marginBottom: 2 }}>
                        Evidence readiness
                      </p>
                      <p style={{ margin: 0, fontSize: 19, fontWeight: 500 }}>
                        {MOCK.evidenceReadiness}%
                      </p>
                    </div>
                  </div>

                  <div className="s-exec-split">
                    <div className="s-exec-box">
                      <h4>Critical Risks</h4>
                      {MOCK.risks.map((risk) => (
                        <div key={risk.id} className="s-exec-item">
                          <span
                            className="s-window-dot"
                            style={{
                              background: risk.dot,
                              width: 6,
                              height: 6,
                            }}
                          />
                          {risk.name}
                          <b className={risk.cls}>{risk.level}</b>
                        </div>
                      ))}
                    </div>

                    <div className="s-exec-box">
                      <h4>Compliance Status</h4>
                      {MOCK.compliance.map((row) => (
                        <div key={row.id} className="s-exec-item">
                          {row.name}
                          <span
                            className="s-mini-track"
                            style={{
                              marginLeft: "auto",
                              width: 56,
                              background: "#E2E8F0",
                            }}
                          >
                            <span
                              className="s-mini-fill"
                              style={{
                                width: `${row.score}%`,
                                background: row.colour,
                                display: "block",
                              }}
                            />
                          </span>
                          <b
                            style={{
                              marginLeft: 0,
                              width: 30,
                              textAlign: "right",
                            }}
                          >
                            {row.score}%
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="s-exec-box">
                    <h4>Recommended Actions</h4>
                    {MOCK.actions.map((action) => (
                      <div key={action.id} className="s-exec-item">
                        <span className="s-exec-tick" />
                        {action.name}
                        <span className="s-exec-due">{action.due}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---- Built for ----------------------------------------------- */}
      <section className="s-section s-light s-light-plain">
        <div className="s-wrap">
          <Reveal className="s-head s-head-wide">
            <h2 className="s-h2">{builtFor.headline}</h2>
          </Reveal>

          <div className="s-segments">
            {builtFor.segments.map((segment, i) => (
              <Reveal
                key={segment.id}
                delay={(i % 2) * 70}
                className="s-segment"
              >
                <h3>{segment.name}</h3>
                <p className="s-body">{segment.description}</p>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="s-note">
              <span />
              <span>{builtFor.jurisdictionNote}</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---- Trust --------------------------------------------------- */}
      <section className="s-section">
        <div className="s-wrap">
          <div className="s-hero-grid" style={{ alignItems: "start" }}>
            <Reveal>
              <h2 className="s-h2">{trust.headline}</h2>
              <p className="s-lead" style={{ maxWidth: 480 }}>
                {trust.body}
              </p>
            </Reveal>

            <Reveal delay={100}>
              <div className="s-trustlist">
                {trust.pillars.map((pillar) => (
                  <Link
                    key={pillar.id}
                    href={siteHref(pillar.href)}
                    className="s-trustrow"
                  >
                    {pillar.name}
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---- Final CTA ----------------------------------------------- */}
      <section className="s-cta s-deep">
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

      <BadgeStrip />
    </>
  );
}
