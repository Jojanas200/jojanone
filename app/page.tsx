import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";
import { getClaims } from "@/server/auth/session";
import { BrandLogo } from "./BrandLogo";
import "./landing.css";

export const metadata = {
  title: "Jojan One - Protect your business. Prove it.",
  description:
    "The Business Protection Operating System for SMEs. Compliance, risk, contracts, people, governance, data protection and business intelligence in one platform - powered by Jova.",
};

// Inter Tight carries the interface voice, Newsreader the evidentiary one (it
// appears only on "Prove it.", section thesis lines, the founder's quote and
// inside document artifacts), IBM Plex Mono every record reference and figure.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

const NAV = [
  ["Capabilities", "#capabilities"],
  ["How it works", "#how-it-works"],
  ["About", "#about"],
  ["Pricing", "#pricing"],
] as const;

// The hero's thesis: the product's own voice, in the product's own format.
const FINDINGS = [
  {
    tone: "red" as const,
    title: "Confirmation statement due in 9 days",
    ref: "COMPLIANCE / CH-0021 · Companies House",
  },
  {
    tone: "amber" as const,
    title: "Supplier agreement renews in 21 days",
    ref: "CONTRACTS / CT-0194 · Acme Logistics",
  },
  {
    tone: "amber" as const,
    title: "Right-to-work check outstanding",
    ref: "PEOPLE / HR-0038 · New starter",
  },
];

// Seven contributing areas. Mean = 82, matching the headline figure.
const LEDGER = [
  ["Compliance", 88],
  ["Risk", 74],
  ["People", 90],
  ["Contracts", 84],
  ["Governance", 79],
  ["Data protection", 80],
  ["Evidence", 79],
] as const;

// Capabilities grouped by the job they do - the same spine as the workflow.
const INDEX = [
  {
    group: "Understand",
    note: "What applies to you",
    items: [
      [
        "Compliance Monitor",
        "Obligations with deadlines, owners and evidence status.",
      ],
      [
        "Risk Management",
        "Identify, score and mitigate risks with real controls.",
      ],
      [
        "GDPR & Data Protection",
        "Processing register, requests, breaches and DPIAs.",
      ],
      [
        "Business Map",
        "Customers, suppliers, team and the key people you depend on.",
      ],
      ["Academy", "Courses and quizzes that build a real training record."],
    ],
  },
  {
    group: "Act",
    note: "Close the gap",
    items: [
      [
        "Policies & Documents",
        "83 guided workflows across policies, contracts and records.",
      ],
      [
        "Contracts",
        "Key terms, renewal dates and notice periods, centralised.",
      ],
      ["People & HR", "Workforce records, checks, training and sign-off."],
      ["Governance", "Decisions, approvals and the minutes that record them."],
      ["Jova", "Guidance across every module, grounded in your business."],
    ],
  },
  {
    group: "Prove",
    note: "Evidence on demand",
    items: [
      [
        "Reports & Evidence",
        "Board-ready packs and exports, already assembled.",
      ],
      [
        "Executive Intelligence",
        "A leadership view of position, priorities and readiness.",
      ],
      ["Business Timeline", "Every material event and change, retained."],
      [
        "Investor & Tender Ready",
        "Due-diligence and bid readiness, maintained continuously.",
      ],
    ],
  },
];

const STEPS = [
  [
    "01",
    "Tell Jojan One about your business",
    "Company, jurisdiction, industry, people and operations - a short guided setup, not a data-entry project.",
  ],
  [
    "02",
    "Jojan One builds Business Memory",
    "The platform holds context about your organisation and keeps it current as things change.",
  ],
  [
    "03",
    "Understand what applies",
    "Relevant obligations, risks and requirements are identified for your business, with the reason each one applies.",
  ],
  [
    "04",
    "Jova explains what matters",
    "Plain-language guidance and recommended actions, with the source behind each one.",
  ],
  [
    "05",
    "Take action",
    "Draft policies, manage risks, review contracts and resolve gaps - inside the same system.",
  ],
  [
    "06",
    "Build evidence",
    "Actions, documents and approvals become part of your business record automatically.",
  ],
  [
    "07",
    "Prove you're ready",
    "Business Confidence, Executive Intelligence and Reports show exactly where you stand.",
  ],
];

const BUILT_FOR = [
  [
    "Startups",
    "Build strong foundations from the beginning - policies, contracts and records done properly from day one.",
  ],
  [
    "Growing SMEs",
    "Keep obligations and risks under control as the organisation grows, without adding headcount.",
  ],
  [
    "Compliance-heavy businesses",
    "Centralise obligations, evidence and risk in one continuously maintained system.",
  ],
  [
    "Investor & tender-ready businesses",
    "Demonstrate governance, readiness and maturity when the moment comes.",
  ],
];

const TRUST = [
  [
    "Workspace isolation",
    "Every record is isolated per workspace by database-enforced row-level security, exercised by automated cross-tenant tests.",
  ],
  [
    "Access controls",
    "Role-based access with read-only roles, scoped adviser access and audited platform administration.",
  ],
  [
    "Grounded AI",
    "Jova grounds its responses in your business information and trusted sources, with citations wherever available.",
  ],
  [
    "Controlled web research",
    "Off by default. When enabled, searches run server-side against official sources only, with queries redacted and every search logged.",
  ],
  [
    "Your evidence, portable",
    "Export your records, reports and documents whenever you need them - CSV, PDF and DOCX.",
  ],
  [
    "Guidance, not advice",
    "Jova is business intelligence and guidance, not regulated legal advice, with professional escalation signposted.",
  ],
];

const PLANS = [
  {
    name: "Starter",
    price: "£39",
    seats: "1 seat",
    blurb: "For founders getting the essentials protected and provable.",
    bullets: [
      "Every protection module",
      "Jova guidance, grounded in your data",
      "Guided document drafting with Jova Policy Check",
      "Business Confidence Score",
    ],
    best: false,
    cta: "Get started",
  },
  {
    name: "Growth",
    price: "£99",
    seats: "Up to 5 seats",
    blurb: "For teams that share the load and need to show their working.",
    bullets: [
      "Everything in Starter",
      "Staff sign-off and training records",
      "Team roles, including read-only",
      "Invite your accountant or adviser",
    ],
    best: true,
    cta: "Get started",
  },
  {
    name: "Executive",
    price: "Talk to us",
    seats: "Custom",
    blurb: "For larger organisations and advisers with bigger footprints.",
    bullets: [
      "Everything in Growth",
      "Custom seats and onboarding support",
      "Feature allocation being finalised",
    ],
    best: false,
    cta: "Talk to us",
  },
];

const FLOW = [
  "Ask Jova",
  "Fill the gaps",
  "Generate",
  "Policy Check",
  "Adopt",
  "Export",
];

const TEAM = [
  {
    name: "Anastasia Ayivor",
    role: "Founder & CEO",
    focus: "Legal, Regulatory Compliance & Business Strategy",
    photo: "/assets/founder.png",
  },
  {
    name: "Kwabena Osei-Tutu",
    role: "Chief Technology Officer",
    focus: "Technology, AI & Product Engineering",
    photo: "/assets/cto.png",
  },
];

function Mark({ n, children }: { n: string; children: string }) {
  return (
    <p className="jo-mark">
      § {n} · {children}
    </p>
  );
}

export default async function LandingPage() {
  // Signed-in visitors go straight to the app.
  const claims = await getClaims();
  if (claims) redirect("/dashboard");

  const assessed = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="jo-page">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} precedence="default" />

      {/* ------------------------------------------------------------- Header */}
      <header className="jo-header">
        <div className="jo-shell jo-header__inner">
          <BrandLogo className="h-8 w-auto" priority />
          <nav className="jo-nav" aria-label="Main">
            {NAV.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className="jo-header__actions">
            <Link href="/login" className="jo-signin">
              Sign in
            </Link>
            <Link href="/login" className="jo-btn jo-btn--primary jo-btn--sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- Hero */}
      <section className="jo-hero">
        <div className="jo-hero__grid" aria-hidden="true">
          <span />
        </div>
        <div className="jo-shell jo-hero__shell">
          <span className="jo-hero__corner">JO / 2026</span>
          <div
            className="jo-rise"
            style={{ "--d": "60ms" } as React.CSSProperties}
          >
            <Mark n="00">
              The Business Protection Operating System for SMEs
            </Mark>
          </div>
          <h1
            className="jo-h1 jo-rise"
            style={{ "--d": "140ms", marginTop: "26px" } as React.CSSProperties}
          >
            Protect your
            <br />
            business.
            <br />
            <em>
              Prove it<i>.</i>
            </em>
          </h1>
          <div className="jo-hero__lower">
            <div>
              <p
                className="jo-lede jo-rise"
                style={{ "--d": "260ms" } as React.CSSProperties}
              >
                Jojan One brings compliance, risk, contracts, people, governance
                and business intelligence together in one intelligent platform -
                so you can understand what matters, take action and prove
                you&apos;re ready.
              </p>
              <div
                className="jo-hero__cta jo-rise"
                style={{ "--d": "340ms" } as React.CSSProperties}
              >
                <Link href="/login" className="jo-btn jo-btn--primary">
                  Get started
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="jo-btn jo-btn--ghost">
                  See how it works
                </a>
              </div>
              <div
                className="jo-hero__foot jo-rise"
                style={{ "--d": "420ms" } as React.CSSProperties}
              >
                <span>No credit card to start</span>
                <span>Grounded answers with citations</span>
                <span>Workspace isolation by design</span>
              </div>
            </div>

            <aside
              className="jo-cover jo-rise"
              style={{ "--d": "480ms" } as React.CSSProperties}
              aria-label="Example protection file"
            >
              <div className="jo-cover__bar">
                <span>Protection file</span>
                <span>JO-WS-0142</span>
              </div>
              <dl className="jo-cover__rows">
                {[
                  ["Business", "Anastasia & Co Ltd"],
                  ["Jurisdiction", "United Kingdom"],
                  ["Obligations tracked", "23"],
                  ["Open risks", "6"],
                  ["Documents adopted", "11"],
                  ["Last assessed", assessed],
                ].map(([k, v]) => (
                  <div key={k} className="jo-cover__row">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </div>
      </section>

      {/* Findings strip - what the product actually says to you */}
      <div
        className="jo-strip jo-rise"
        style={{ "--d": "520ms" } as React.CSSProperties}
      >
        <div className="jo-shell jo-strip__inner">
          <p className="jo-strip__label">Today · 3 to attend to</p>
          {FINDINGS.map((f) => (
            <div key={f.ref} className="jo-finding">
              <span className={`jo-dot jo-dot--${f.tone}`} aria-hidden="true" />
              <span className="jo-finding__body">
                <span className="jo-finding__title">{f.title}</span>
                <span className="jo-finding__ref">{f.ref}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------ Thesis */}
      <section className="jo-section jo-section--cloud">
        <div className="jo-shell">
          <Mark n="01">The premise</Mark>
          <p className="jo-thesis" style={{ marginTop: "22px" }}>
            We turn scattered obligations into one clear, <em>provable</em>{" "}
            picture of whether your business is protected.
          </p>
          <div className="jo-cols jo-cols--3">
            {[
              [
                "Grounded",
                "Jova grounds its responses in your business information and trusted sources, with citations wherever available - and says so plainly when something cannot be verified.",
              ],
              [
                "Honest",
                "Guidance to help you act, not regulated advice. Safety notices, exports and expert escalation are never behind a paywall.",
              ],
              [
                "Yours",
                "Strict per-workspace isolation, enforced in the database and exercised by automated tests. Your records stay your records.",
              ],
            ].map(([t, d]) => (
              <div key={t} className="jo-col">
                <h3 className="jo-h3">{t}</h3>
                <p className="jo-copy">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- The workspace */}
      <section className="jo-section">
        <div className="jo-shell jo-split jo-split--top">
          <div>
            <Mark n="02">One workspace</Mark>
            <h2 className="jo-h2">
              Everything that protects your business, in one file.
            </h2>
            <p className="jo-copy jo-copy--ink" style={{ marginTop: "20px" }}>
              Obligations, risks, contracts, people, policies and evidence stop
              being separate spreadsheets. They become one connected record -
              and because everything shares that record, Jova can reason across
              all of it.
            </p>
            <a
              href="#capabilities"
              className="jo-link"
              style={{ marginTop: "22px" }}
            >
              See every capability
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div>
            <div className="jo-ui">
              <div className="jo-ui__bar">
                <span>Jojan One · Dashboard</span>
                <span>Anastasia &amp; Co Ltd</span>
              </div>
              <div className="jo-ui__body">
                <div className="jo-row">
                  <span>
                    <span className="jo-row__name">
                      Confirmation statement (CS01)
                    </span>
                    <span className="jo-row__meta">
                      COMPLIANCE / CH-0021 · Due 30 Sep
                    </span>
                  </span>
                  <span className="jo-chip jo-chip--red">Action required</span>
                </div>
                <div className="jo-row">
                  <span>
                    <span className="jo-row__name">
                      Single point of failure in dispatch
                    </span>
                    <span className="jo-row__meta">
                      RISK / RK-0007 · 4 × 5 · Review 15 Sep
                    </span>
                  </span>
                  <span className="jo-chip jo-chip--amber">High</span>
                </div>
                <div className="jo-row">
                  <span>
                    <span className="jo-row__name">
                      Northwind Services Agreement
                    </span>
                    <span className="jo-row__meta">
                      CONTRACTS / CT-0194 · 60-day notice
                    </span>
                  </span>
                  <span className="jo-chip jo-chip--amber">Renews soon</span>
                </div>
                <div className="jo-row">
                  <span>
                    <span className="jo-row__name">Data Protection Policy</span>
                    <span className="jo-row__meta">
                      POLICIES / PL-0003 · v1.0 · Adopted
                    </span>
                  </span>
                  <span className="jo-chip jo-chip--teal">Active</span>
                </div>
                <div className="jo-row">
                  <span>
                    <span className="jo-row__name">
                      GDPR Essentials - final quiz
                    </span>
                    <span className="jo-row__meta">
                      ACADEMY / JO-CRSGDPRE · 88% · Certificate issued
                    </span>
                  </span>
                  <span className="jo-chip jo-chip--blue">Complete</span>
                </div>
              </div>
              <div className="jo-tiles">
                {[
                  "Compliance",
                  "Risk",
                  "Contracts",
                  "People",
                  "GDPR",
                  "Governance",
                  "Policies",
                  "Evidence",
                  "Executive",
                  "Timeline",
                  "Reports",
                  "Academy",
                ].map((t) => (
                  <span key={t} className="jo-tile">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <p className="jo-note" style={{ marginTop: "12px" }}>
              Illustration of the Jojan One workspace.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------- Signature: Business Confidence */}
      <section id="confidence" className="jo-section jo-section--navy">
        <div className="jo-shell">
          <Mark n="03">Business Confidence Score</Mark>
          <h2 className="jo-h2 jo-h2--wide">
            One number. Your business protection picture.
          </h2>

          <div className="jo-score">
            <div>
              <span className="jo-score__num">82</span>
              <span className="jo-score__band">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Strong
              </span>
              <p className="jo-score__stamp">
                Assessed {assessed}
                <br />
                Reference JO-BCS-4417 · 7 areas · 41 indicators
              </p>
            </div>

            <div>
              <div className="jo-ledger">
                {LEDGER.map(([name, val], i) => (
                  <div key={name} className="jo-ledger__row">
                    <span className="jo-ledger__name">{name}</span>
                    <span className="jo-ledger__val">{val}</span>
                    <span className="jo-meter" aria-hidden="true">
                      <span
                        style={{
                          width: `${val}%`,
                          animationDelay: `${120 + i * 70}ms`,
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <p
                className="jo-copy"
                style={{ marginTop: "26px", maxWidth: "52ch" }}
              >
                Every point traces back to something identifiable in your
                workspace - an overdue obligation, an open high risk, a policy
                past review, a missing record. Ask{" "}
                <strong style={{ color: "#fff", fontWeight: 500 }}>
                  &quot;How is my score calculated?&quot;
                </strong>{" "}
                and Jova shows the working, area by area.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Capabilities */}
      <section id="capabilities" className="jo-section">
        <div className="jo-shell">
          <Mark n="04">Capabilities</Mark>
          <h2 className="jo-h2">Fourteen capabilities. One system.</h2>
          <p
            className="jo-copy jo-copy--ink"
            style={{ marginTop: "18px", maxWidth: "56ch" }}
          >
            Grouped by the job they do, because that is how protection actually
            works: understand what applies, act on it, then prove it.
          </p>

          <div className="jo-index">
            {INDEX.map((g) => (
              <div key={g.group} className="jo-index__group">
                <div className="jo-index__head">
                  <h3>{g.group}</h3>
                  <p>{g.note}</p>
                </div>
                <div className="jo-index__rows">
                  {g.items.map(([name, desc], i) => (
                    <div key={name} className="jo-item">
                      <span className="jo-item__no">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <span className="jo-item__name">{name}</span>
                        <span className="jo-item__desc">{desc}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Jova */}
      <section id="jova" className="jo-section jo-section--navy">
        <div className="jo-shell jo-split jo-split--top">
          <div>
            <Mark n="05">Meet Jova</Mark>
            <h2 className="jo-h2">
              Your intelligent business protection assistant.
            </h2>
            <p className="jo-lede">
              Jova reads your own registers, documents and people - then
              explains what happened, why it matters, what to do and where the
              evidence lives.
            </p>
            <ul className="jo-ticks">
              {[
                "Your business data first, then Jojan One's regulatory knowledge, then official sources",
                "Citations wherever available, and a straight answer when something cannot be verified",
                "Reads the documents you attach: PDF, Word, CSV and more",
                "Jurisdiction-aware by design - UK regulatory intelligence at launch, more introduced progressively",
              ].map((t) => (
                <li key={t}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="jo-jova">
            <p className="jo-jova__head">
              <Sparkles
                className="h-4 w-4"
                style={{ color: "var(--jo-teal)" }}
                aria-hidden="true"
              />
              Jova found 3 things requiring your attention
            </p>
            <div className="jo-jova__body">
              {[
                ["red", "Employment document requires review"],
                ["amber", "Data protection obligation requires verification"],
                ["amber", "Supplier agreement expires in 21 days"],
              ].map(([tone, text]) => (
                <div key={text} className="jo-jova__f">
                  <span
                    className={`jo-dot jo-dot--${tone}`}
                    style={{ transform: "none" }}
                    aria-hidden="true"
                  />
                  {text}
                </div>
              ))}

              <p className="jo-jova__ask">
                Ask Jova: <strong>What should I deal with first?</strong>
              </p>

              <div className="jo-anat">
                {[
                  [
                    "What happened",
                    "Your supplier agreement with Acme Logistics reaches its renewal date in 21 days.",
                  ],
                  [
                    "Why it matters",
                    "It renews for a further 12 months unless notice is given 14 days before renewal.",
                  ],
                  [
                    "What to do",
                    "Review the renewal terms this week and give notice by the 7th if you want to renegotiate.",
                  ],
                  [
                    "Source",
                    "Contracts register - Acme Logistics Services Agreement, renewal clause",
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="jo-anat__k">{k}</span>
                    <p>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Documents */}
      <section id="documents" className="jo-section jo-section--cloud">
        <div className="jo-shell jo-split jo-split--top">
          <div>
            <Mark n="06">Documents</Mark>
            <h2 className="jo-h2">From obligation to document.</h2>
            <p className="jo-copy jo-copy--ink" style={{ marginTop: "20px" }}>
              Create business documents using what Jojan One already understands
              about your organisation. Jova asks only what it needs, writes the
              draft, checks it before adoption - and never invents facts about
              your company.
            </p>
            <div className="jo-flow">
              {FLOW.map((s, i) => (
                <Fragment key={s}>
                  <span>{s}</span>
                  {i < FLOW.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Fragment>
              ))}
            </div>
            <p className="jo-copy" style={{ marginTop: "24px" }}>
              Employee handbooks, privacy and data protection policies, HR
              policies, governance records, contracts and letters - each
              carrying the review wording it should, and a clean
              document-control export once adopted.
            </p>
          </div>

          <div className="jo-doc">
            <span className="jo-doc__stamp">Draft - review before use</span>
            <h3 className="jo-doc__title">Data Protection Policy</h3>
            <dl className="jo-doc__control">
              {[
                ["Version", "v1.0"],
                ["Owner", "Founder & CEO"],
                ["Effective date", "On adoption"],
                ["Next review", "12 months"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="jo-doc__clause">
              <h4>1. Purpose</h4>
              <p>
                Anastasia &amp; Co Ltd collects, uses and protects personal data
                lawfully, fairly and transparently. This policy explains how
                that is done and who is accountable for it.
              </p>
              <h4>2. Scope</h4>
              <p>
                This policy applies to all staff, contractors and volunteers
                acting on behalf of the business, and to every system in which
                personal data is held.
              </p>
            </div>
            <div className="jo-doc__foot">
              <span className="jo-chip jo-chip--teal">Policy Check passed</span>
              <span className="jo-chip jo-chip--blue">PDF · DOCX</span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- How it works */}
      <section id="how-it-works" className="jo-section">
        <div className="jo-shell">
          <Mark n="07">How Jojan One works</Mark>
          <h2 className="jo-h2">From first answers to provable readiness.</h2>

          <div className="jo-seq">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="jo-step">
                <span className="jo-step__no">{n}</span>
                <h3 className="jo-h3">{t}</h3>
                <p className="jo-copy" style={{ margin: 0 }}>
                  {d}
                </p>
              </div>
            ))}
          </div>

          <p className="jo-spine">
            Understand <i>→</i> Monitor <i>→</i> Act <i>→</i> Evidence <i>→</i>{" "}
            Prove
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- Built for */}
      <section className="jo-section jo-section--cloud jo-section--tight">
        <div className="jo-shell">
          <Mark n="08">Built for</Mark>
          <h2 className="jo-h2 jo-h2--wide">
            Built for businesses that need clarity, not complexity.
          </h2>
          <div className="jo-cols jo-cols--4">
            {BUILT_FOR.map(([t, d]) => (
              <div key={t} className="jo-col">
                <h3 className="jo-h3">{t}</h3>
                <p className="jo-copy">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- About */}
      <section id="about" className="jo-section">
        <div className="jo-shell">
          <Mark n="09">About Jojan One</Mark>
          <h2 className="jo-h2 jo-h2--wide">
            Business protection shouldn&apos;t require ten different systems.
          </h2>

          <div className="jo-split jo-split--top" style={{ marginTop: "44px" }}>
            <div>
              <p className="jo-copy jo-copy--ink" style={{ marginTop: 0 }}>
                Jojan One is an intelligent business protection platform
                designed to bring the essential layers of running a protected,
                compliant and investment-ready business together in one place.
              </p>
              <p className="jo-copy jo-copy--ink">
                From compliance and risk to contracts, people, governance and
                data protection, it helps businesses understand their
                obligations, identify what needs attention, take action and
                maintain the evidence to prove it.
              </p>
              <p className="jo-copy jo-copy--ink">
                At the centre is Jova, which uses business context, regulatory
                intelligence and trusted sources to help organisations
                understand what matters and what to do next.
              </p>
              <p className="jo-copy jo-copy--ink">
                Our vision is simple: make business protection understandable,
                actionable and accessible - wherever a business operates.
              </p>
            </div>
            <div style={{ display: "grid", gap: "16px" }}>
              <div className="jo-card">
                <h3 className="jo-h3">Our mission</h3>
                <p className="jo-copy">
                  To give every business the intelligence, tools and confidence
                  to understand its obligations, manage its risks and prove its
                  readiness.
                </p>
              </div>
              <div className="jo-card">
                <h3 className="jo-h3">Our vision</h3>
                <p className="jo-copy">
                  A world where business protection is continuous, intelligent
                  and built into the way companies operate - rather than
                  something they think about only when something goes wrong.
                </p>
              </div>
              <div className="jo-card" id="story">
                <h3 className="jo-h3">Our story</h3>
                <p className="jo-copy">
                  Growing businesses are expected to manage increasingly complex
                  responsibilities across compliance, contracts, employment,
                  governance, data protection and risk - yet the tools to manage
                  them are scattered across systems, advisers, documents and
                  spreadsheets. Jojan One was built to bring those pieces
                  together as an intelligent protection layer around the
                  business. What began with legal and compliance expertise is
                  becoming a broader business intelligence platform.
                </p>
              </div>
            </div>
          </div>

          {/* Founder */}
          <div id="founder" className="jo-founder">
            <div className="jo-portrait">
              <Image
                src="/assets/founder.png"
                alt="Anastasia Ayivor, Founder and CEO of Jojan One"
                width={720}
                height={1000}
                sizes="320px"
              />
            </div>
            <div>
              <Mark n="10">Founder</Mark>
              <h3
                className="jo-h2"
                style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
              >
                Anastasia Ayivor
              </h3>
              <p className="jo-note" style={{ marginTop: "10px" }}>
                Founder &amp; CEO, Jojan One
              </p>
              <p className="jo-copy" style={{ marginTop: "22px" }}>
                Anastasia Ayivor is the Founder and CEO of Jojan One, an
                AI-powered LegalTech and RegTech platform built to help
                businesses understand their obligations, manage risk and
                demonstrate their readiness.
              </p>
              <p className="jo-copy">
                With an academic background in law, including an LLB and an LLM
                in Commercial Law, and professional experience across regulatory
                reporting, compliance and business advisory, she has worked
                closely with organisations navigating the practical challenges
                of governance, regulation, contracts and operational risk.
              </p>
              <p className="jo-copy">
                Through that experience she identified a recurring problem:
                small and growing businesses are expected to meet many of the
                same legal, regulatory and governance responsibilities as larger
                organisations, but without dedicated legal, compliance or risk
                teams. Jojan One was created to close that gap.
              </p>
              <p className="jo-copy">
                Her vision is to build Jojan One into a global business
                protection infrastructure that makes sophisticated compliance
                and risk intelligence accessible to businesses regardless of
                size or location.
              </p>
              <blockquote className="jo-quote">
                <p>
                  Businesses shouldn&apos;t have to wait until something goes
                  wrong to discover what they should have been doing all along.
                </p>
                <footer>Anastasia Ayivor, Founder &amp; CEO</footer>
              </blockquote>
            </div>
          </div>

          {/* Leadership & Team */}
          <div id="team" style={{ marginTop: "76px" }}>
            <Mark n="11">Leadership &amp; Team</Mark>
            <div className="jo-people">
              {TEAM.map((m) => (
                <div key={m.name} className="jo-person">
                  {m.photo ? (
                    <Image
                      src={m.photo}
                      alt={m.name}
                      width={136}
                      height={136}
                      sizes="68px"
                    />
                  ) : (
                    <span className="jo-person__ph" aria-hidden="true">
                      {m.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                  )}
                  <span>
                    <span
                      className="jo-item__name"
                      style={{ display: "block", fontSize: "1rem" }}
                    >
                      {m.name}
                    </span>
                    <span className="jo-row__meta" style={{ display: "block" }}>
                      {m.role}
                    </span>
                    <span
                      className="jo-item__desc"
                      style={{ display: "block" }}
                    >
                      {m.focus}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Trust */}
      <section id="trust" className="jo-section jo-section--cloud">
        <div className="jo-shell">
          <Mark n="12">Trust Centre</Mark>
          <h2 className="jo-h2">Built to be trusted with your business.</h2>
          <p
            className="jo-copy jo-copy--ink"
            style={{ marginTop: "18px", maxWidth: "54ch" }}
          >
            Everything below describes how the platform is actually built. We
            don&apos;t make security claims because they sound good.
          </p>
          <div className="jo-cols jo-cols--3">
            {TRUST.map(([t, d]) => (
              <div key={t} className="jo-col">
                <h3 className="jo-h3">{t}</h3>
                <p className="jo-copy">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Pricing */}
      <section id="pricing" className="jo-section">
        <div className="jo-shell">
          <Mark n="13">Pricing</Mark>
          <h2 className="jo-h2">Simple, honest pricing.</h2>
          <p
            className="jo-copy jo-copy--ink"
            style={{ marginTop: "18px", maxWidth: "52ch" }}
          >
            Safety notices, exports and professional-support escalation are
            always available - never behind a paywall.
          </p>

          <div className="jo-plans">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`jo-plan${p.best ? " jo-plan--best" : ""}`}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <h3 className="jo-plan__name">{p.name}</h3>
                  {p.best && <span className="jo-badge">Most popular</span>}
                </div>
                <p className="jo-plan__price">
                  {p.price}
                  {p.price.startsWith("£") && <small> /mo</small>}
                </p>
                <p className="jo-plan__seats">{p.seats}</p>
                <p className="jo-plan__blurb">{p.blurb}</p>
                <ul>
                  {p.bullets.map((b) => (
                    <li key={b}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`jo-btn ${p.best ? "jo-btn--onnavy" : "jo-btn--primary"}`}
                >
                  {p.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
          <p className="jo-note" style={{ marginTop: "20px" }}>
            Plan feature allocation is configurable and being finalised.
            Early-access workspaces include the full platform.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- Close */}
      <section className="jo-section jo-section--navy jo-close">
        <div className="jo-shell">
          <Mark n="14">Get started</Mark>
          <h2 className="jo-h2">Start proving it today.</h2>
          <p className="jo-lede">
            Create your workspace in minutes. See your Business Confidence
            Score, and know exactly where you stand.
          </p>
          <div className="jo-close__cta">
            <Link href="/login" className="jo-btn jo-btn--onnavy">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#capabilities"
              className="jo-btn"
              style={{
                borderColor: "rgba(255,255,255,0.28)",
                color: "#fff",
              }}
            >
              Explore capabilities
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Footer */}
      <footer className="jo-footer">
        <div className="jo-shell">
          <div className="jo-footer__grid">
            <div>
              <span className="jo-footer__brand">Jojan One</span>
              <p className="jo-copy" style={{ maxWidth: "30ch" }}>
                The Business Protection Operating System for SMEs. Protect your
                business, and prove it - guidance, not advice.
              </p>
              <p className="jo-note" style={{ marginTop: "16px" }}>
                Jurisdiction-aware protection at its core
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                {[
                  ["Capabilities", "#capabilities"],
                  ["Jova", "#jova"],
                  ["Business Confidence", "#confidence"],
                  ["Documents", "#documents"],
                  ["How it works", "#how-it-works"],
                  ["Pricing", "#pricing"],
                ].map(([l, h]) => (
                  <li key={h}>
                    <a href={h}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                {[
                  ["About", "#about"],
                  ["Our story", "#story"],
                  ["Founder", "#founder"],
                  ["Leadership & Team", "#team"],
                ].map(([l, h]) => (
                  <li key={h}>
                    <a href={h}>{l}</a>
                  </li>
                ))}
                <li>
                  <a href="mailto:hello@jojan.one">Contact</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Trust</h4>
              <ul>
                <li>
                  <a href="#trust">Trust Centre</a>
                </li>
                <li>
                  <a href="#trust">Security &amp; isolation</a>
                </li>
                <li>
                  <a href="#trust">Responsible AI</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Get started</h4>
              <ul>
                <li>
                  <Link href="/login">Sign in</Link>
                </li>
                <li>
                  <Link href="/login">Create your workspace</Link>
                </li>
                <li>
                  <a href="mailto:hello@jojan.one">hello@jojan.one</a>
                </li>
                <li>London, United Kingdom</li>
              </ul>
            </div>
          </div>
          <div className="jo-footer__bar">
            <span>
              © {new Date().getFullYear()} Jojan One · Guidance, not advice
            </span>
            <span>Understand · Monitor · Act · Evidence · Prove</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
