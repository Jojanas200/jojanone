import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Lock,
  Sparkles,
  Building2,
  TrendingUp,
  FileBarChart,
  ArrowRight,
  ArrowUpRight,
  Mail,
  MapPin,
  Users,
  Landmark,
  CalendarClock,
  Map,
  GraduationCap,
  Globe2,
  CheckCircle2,
  BookOpenCheck,
  Download,
} from "lucide-react";
import { getClaims } from "@/server/auth/session";
import { BrandLogo } from "./BrandLogo";
import { ThemeSwitcher } from "./ThemeSwitcher";

export const metadata = {
  title: "Jojan One - Protect your business. Prove it.",
  description:
    "The Business Protection Operating System for SMEs. Compliance, risk, contracts, people, governance, data protection and business intelligence in one platform - powered by Jova.",
};

// Clash Display + Satoshi power the default (Swiss) theme; the Soft-UI theme
// swaps to Plus Jakarta Sans + DM Sans (loaded in the root layout).
const FONTSHARE =
  "https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700&display=swap";

// Brand accents used on constant-colour sections (the Jova panel keeps Deep
// Navy + Teal across every theme; everything else follows the theme tokens).
const NAVY = "#071A33";
const TEAL = "#14B8A6";

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    title: "Compliance Monitor",
    desc: "Understand and track your obligations, with deadlines, owners and evidence status.",
  },
  {
    icon: AlertTriangle,
    title: "Risk Management",
    desc: "Identify, assess and manage business risks with scoring, controls and mitigations.",
  },
  {
    icon: FileText,
    title: "Contracts",
    desc: "Centralise agreements and understand key terms, renewals and obligations.",
  },
  {
    icon: BookOpenCheck,
    title: "Policies & Documents",
    desc: "Create, check, adopt and manage essential business documentation.",
  },
  {
    icon: Users,
    title: "People & HR",
    desc: "Manage key workforce obligations, records, training and sign-off.",
  },
  {
    icon: Lock,
    title: "GDPR & Data Protection",
    desc: "Understand and manage privacy responsibilities - ROPA, requests, breaches, DPIAs.",
  },
  {
    icon: Landmark,
    title: "Governance",
    desc: "Decisions, approvals and records that show oversight and accountability.",
  },
  {
    icon: TrendingUp,
    title: "Executive Intelligence",
    desc: "A leadership-level view of position, priorities, risk and readiness.",
  },
  {
    icon: CalendarClock,
    title: "Business Timeline",
    desc: "Retain important business events and changes as a living record.",
  },
  {
    icon: FileBarChart,
    title: "Reports & Evidence",
    desc: "Board-ready packs and exports that demonstrate what has been done.",
  },
  {
    icon: Map,
    title: "Business Map",
    desc: "Customers, suppliers, team and key people - the relationships you depend on.",
  },
  {
    icon: GraduationCap,
    title: "Academy",
    desc: "Courses, quizzes and certificates that build a real training record.",
  },
  {
    icon: Building2,
    title: "Investor & Tender Ready",
    desc: "Due-diligence and bid readiness, maintained continuously.",
  },
  {
    icon: Sparkles,
    title: "Jova",
    desc: "Intelligent assistance across the platform - grounded in your business.",
  },
];

const JOURNEY = [
  {
    n: "01",
    t: "Tell Jojan One about your business",
    d: "Company, jurisdiction, industry, people and operations - a short guided setup.",
  },
  {
    n: "02",
    t: "Jojan One builds Business Memory",
    d: "The platform develops context about your organisation and keeps it current.",
  },
  {
    n: "03",
    t: "Understand what applies",
    d: "Relevant obligations, risks and requirements are identified for your business.",
  },
  {
    n: "04",
    t: "Jova explains what matters",
    d: "Plain-language guidance and recommended actions, with sources.",
  },
  {
    n: "05",
    t: "Take action",
    d: "Create policies, manage risks, review contracts and resolve gaps.",
  },
  {
    n: "06",
    t: "Build evidence",
    d: "Actions and documents become part of your business record automatically.",
  },
  {
    n: "07",
    t: "Prove you're ready",
    d: "Business Confidence, Executive Intelligence and Reports show where you stand.",
  },
];

const BUILT_FOR = [
  {
    t: "Startups",
    d: "Build strong foundations from the beginning - policies, contracts and records done properly from day one.",
  },
  {
    t: "Growing SMEs",
    d: "Keep obligations and risks under control as the organisation grows, without adding headcount.",
  },
  {
    t: "Compliance-heavy businesses",
    d: "Centralise obligations, evidence and risk in one continuously maintained system.",
  },
  {
    t: "Investor & tender-ready businesses",
    d: "Demonstrate governance, readiness and business maturity when the moment comes.",
  },
];

// Pricing is architecture-first: features live in these arrays so plans can be
// re-allocated without touching the layout. Final allocation is being
// confirmed; early-access workspaces currently include the full platform.
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
    highlight: false,
    cta: "Get started",
  },
  {
    name: "Growth",
    price: "£99",
    seats: "Up to 5 seats",
    blurb: "For teams that share the load - and need to show their working.",
    bullets: [
      "Everything in Starter",
      "Staff sign-off and training records",
      "Team roles, incl. read-only and adviser access",
      "Invite your accountant or adviser",
    ],
    highlight: true,
    cta: "Get started",
  },
  {
    name: "Executive",
    price: "Talk to us",
    seats: "Custom",
    blurb: "For larger organisations and advisers with bigger footprints.",
    bullets: [
      "Custom seats and onboarding support",
      "Everything in Growth",
      "Feature allocation being finalised",
    ],
    highlight: false,
    cta: "Talk to us",
  },
];

const SCORE = [
  ["Compliance", 88],
  ["Risk", 74],
  ["People", 90],
  ["Contracts", 84],
  ["Governance", 79],
  ["Data protection", 80],
  ["Evidence", 86],
] as const;

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

const TRUST = [
  {
    t: "Workspace isolation",
    d: "Every record is isolated per workspace with database-enforced row-level security, exercised by automated cross-tenant tests.",
  },
  {
    t: "Access controls",
    d: "Role-based access with read-only roles, scoped adviser access and audited platform administration.",
  },
  {
    t: "Grounded AI",
    d: "Jova grounds its responses in your business information and trusted sources, with citations wherever available.",
  },
  {
    t: "Controlled web research",
    d: "Off by default. When enabled, searches run server-side against official sources only, with queries redacted and every search logged.",
  },
  {
    t: "Your evidence, portable",
    d: "Export your records, reports and documents whenever you need them - CSV, PDF and DOCX.",
  },
  {
    t: "Guidance, not advice",
    d: "Jova is business intelligence and guidance, not regulated legal advice - with professional escalation signposted where it matters.",
  },
];

// Offset "echo" layers behind hero text (fading grays, shifted up-left). Colours
// come from --ld-echo* so the effect re-tints per theme.
function EchoText({ text, className }: { text: string; className?: string }) {
  const layers = [
    { c: "var(--ld-echo4)", o: "-0.16em" },
    { c: "var(--ld-echo3)", o: "-0.12em" },
    { c: "var(--ld-echo2)", o: "-0.08em" },
    { c: "var(--ld-echo1)", o: "-0.04em" },
  ];
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      {layers.map((l) => (
        <span
          key={l.o}
          aria-hidden="true"
          className="echo-layer"
          style={{ color: l.c, transform: `translate(${l.o}, ${l.o})` }}
        >
          {text}
        </span>
      ))}
      <span className="relative text-[var(--ld-ink)]">{text}</span>
    </span>
  );
}

const easing = "ease-[cubic-bezier(0.77,0,0.175,1)]";
const pillBtn = `inline-flex items-center gap-2 rounded-full text-sm font-medium duration-300 ${easing}`;

export default async function LandingPage() {
  // Signed-in visitors go straight to the app.
  const claims = await getClaims();
  if (claims) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[var(--ld-bg)] font-[family-name:var(--ld-font-body)] text-[var(--ld-ink)] antialiased">
      <link rel="preconnect" href="https://api.fontshare.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTSHARE} precedence="default" />

      {/* ---------------------------------------------------------------- Header */}
      <header className="sticky top-0 z-50 h-20 border-b border-[color:var(--ld-line)] bg-[var(--ld-bg)]/85 backdrop-blur-[12px]">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <BrandLogo className="h-9 w-auto" priority />
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["Capabilities", "#capabilities"],
              ["How it works", "#how-it-works"],
              ["About", "#about"],
              ["Pricing", "#pricing"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[13px] uppercase tracking-[0.08em] text-[var(--ld-ink)] transition-colors duration-150 hover:text-[var(--ld-muted)]"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeSwitcher className="hidden items-center gap-1 text-[10px] uppercase tracking-[0.06em] text-[var(--ld-muted)] transition-colors hover:text-[var(--ld-ink)] lg:inline-flex" />
            <Link
              href="/login"
              className="hidden px-2 py-2 text-[13px] uppercase tracking-[0.08em] text-[var(--ld-ink)] transition-colors duration-150 hover:text-[var(--ld-muted)] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="ld-btn-primary rounded-full px-5 py-2.5 text-[13px] uppercase tracking-[0.08em]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Background photograph */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[url(/assets/hero.jpg)] bg-cover bg-center"
        />
        {/* Theme-aware scrim: opaque toward the left (where the copy sits),
            revealing the photo on the right. color-mix on --ld-bg means it
            lightens in Classic/Soft UI and darkens in Dark automatically. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, var(--ld-bg) 0%, color-mix(in oklab, var(--ld-bg) 82%, transparent) 48%, color-mix(in oklab, var(--ld-bg) 38%, transparent) 100%)",
          }}
        />
        {/* Fade into the page colour at the bottom edge for a seamless join. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-40"
          style={{
            background: "linear-gradient(to bottom, transparent, var(--ld-bg))",
          }}
        />
        <div className="mx-auto flex min-h-[86vh] max-w-7xl flex-col justify-center px-6 py-24">
          <p className="mb-8 text-[13px] uppercase tracking-[0.22em] text-[var(--ld-muted)]">
            The Business Protection Operating System for SMEs
          </p>
          <h1 className="font-clash font-bold leading-[0.9] tracking-[-0.05em]">
            <span className="block text-[13vw] sm:text-[11vw] lg:text-[150px]">
              Protect your
            </span>
            <span className="mt-1 block text-[13vw] sm:text-[11vw] lg:text-[150px]">
              business.
            </span>
            <EchoText
              text="Prove it."
              className="mt-1 block text-[13vw] sm:text-[11vw] lg:text-[150px]"
            />
          </h1>
          <div className="mt-12 flex max-w-3xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xl text-lg leading-relaxed text-[var(--ld-body)]">
              Jojan One brings compliance, risk, contracts, people, governance
              and business intelligence together in one intelligent platform -
              so you can understand what matters, take action and prove
              you&apos;re ready.
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/login"
                className={`ld-btn-primary group px-6 py-3 ${pillBtn}`}
              >
                Get started
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#how-it-works"
                className={`ld-btn-outline px-6 py-3 ${pillBtn}`}
              >
                See how it works
              </a>
            </div>
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.14em] text-[var(--ld-muted)]">
            No credit card to start &nbsp;·&nbsp; Grounded answers with
            citations &nbsp;·&nbsp; Workspace isolation by design
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- Statement */}
      <section className="border-t border-[color:var(--ld-line)] bg-[var(--ld-panel)]">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center">
          <div className="mx-auto mb-10 h-16 w-px bg-[var(--ld-strong)]/15" />
          <p className="font-clash text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
            We turn scattered obligations into one clear,{" "}
            <span className="font-display italic">provable</span> picture of
            whether your business is protected.
          </p>
          <div className="mt-20 grid gap-8 text-left sm:grid-cols-3">
            {[
              {
                t: "Grounded",
                d: "Jova grounds its responses in your business information and trusted sources, with citations wherever available - and says so when something cannot be verified.",
              },
              {
                t: "Honest",
                d: "Guidance to help you act, not regulated advice. Safety notices, exports and expert escalation are never behind a paywall.",
              },
              {
                t: "Yours",
                d: "Strict per-workspace isolation, enforced in the database and exercised by automated tests. Your records stay your records.",
              },
            ].map((c) => (
              <div key={c.t}>
                <h3 className="font-clash text-2xl font-semibold tracking-[-0.02em]">
                  {c.t}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ld-body)]">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------- Business Confidence + stats */}
      <section id="confidence" className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Business Confidence - dark panel */}
          <div className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-invert-bg)] p-8 text-[var(--ld-invert-ink)] md:col-span-8 md:p-12">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-invert-ink)]/50">
              Business Confidence Score
            </p>
            <h2 className="font-clash mt-3 text-3xl font-semibold tracking-[-0.03em]">
              One number. Your business protection picture.
            </h2>
            <div className="mt-8 flex flex-wrap items-end gap-10">
              <div>
                <span className="font-clash text-[110px] font-bold leading-[0.8] tracking-[-0.05em]">
                  82
                </span>
                <p
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em]"
                  style={{ backgroundColor: `${TEAL}22`, color: TEAL }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Strong
                </p>
              </div>
              <div className="mb-2 w-full max-w-xs space-y-2.5">
                {SCORE.map(([label, val]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs text-[var(--ld-invert-ink)]/60">
                      <span>{label}</span>
                      <span className="tabular-nums">{val}</span>
                    </div>
                    <div className="h-px w-full bg-[var(--ld-invert-ink)]/15">
                      <div
                        className={`h-px bg-[var(--ld-invert-ink)] duration-700 ${easing}`}
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-8 max-w-lg text-sm leading-relaxed text-[var(--ld-invert-ink)]/60">
              Every point traces to identifiable indicators in your workspace -
              overdue obligations, open risks, missing records - never an
              unexplained number. Ask{" "}
              <span className="text-[var(--ld-invert-ink)]">
                &quot;How is my score calculated?&quot;
              </span>{" "}
              and Jova shows the working.
            </p>
          </div>

          {/* Pill-shaped vertical stat */}
          <div className="ld-surface flex flex-col justify-between rounded-full bg-[var(--ld-panel)] p-8 md:col-span-4">
            <p className="text-center text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Document workflows
            </p>
            <div className="py-8 text-center">
              <span className="font-clash text-[110px] font-bold leading-none tracking-[-0.05em]">
                83
              </span>
              <p className="font-clash mt-2 text-2xl font-semibold tracking-[-0.02em]">
                guided workflows
              </p>
            </div>
            <p className="text-center text-sm text-[var(--ld-body)]">
              Policies, handbooks, contracts, letters and records - not
              eighty-three blank templates.
            </p>
          </div>

          {/* Square stat */}
          <div className="ld-surface flex aspect-square flex-col justify-between rounded-[var(--ld-radius)] bg-[var(--ld-panel)] p-8 md:col-span-5">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Always on
            </p>
            <div>
              <span className="font-clash text-6xl font-bold tracking-[-0.04em]">
                Jova
              </span>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--ld-body)]">
                Reviews your business daily, surfaces what needs attention and
                points to the fix - in plain language, with sources.
              </p>
            </div>
          </div>

          {/* Wide statement */}
          <div className="ld-surface flex flex-col justify-center rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-8 md:col-span-7 md:p-12">
            <p className="font-clash text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
              Ready before they ask.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--ld-body)]">
              Investor due-diligence, tender bids, lender reviews - the evidence
              is already assembled, dated and exportable when the moment comes.
            </p>
            <a
              href="#capabilities"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[var(--ld-ink)]"
            >
              Explore capabilities
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Jova (Deep Navy) */}
      <section
        id="jova"
        style={{ backgroundColor: NAVY }}
        className="text-white"
      >
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <p
                className="text-[13px] uppercase tracking-[0.16em]"
                style={{ color: TEAL }}
              >
                Meet Jova
              </p>
              <h2 className="font-clash mt-4 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
                Your intelligent business protection assistant.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70">
                Jova understands your business context - your registers, your
                documents, your people - and uses it to explain what happened,
                why it matters, what to do and where the evidence lives. Not a
                generic chatbot.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-white/80">
                {[
                  "Company data first, then Jojan One's regulatory knowledge, then official sources",
                  "Citations wherever available - and a straight answer when something cannot be verified",
                  "Reads the documents you attach: PDF, Word, CSV and more",
                  "Built with jurisdiction-aware business protection at its core - UK regulatory intelligence at launch, more jurisdictions progressively",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: TEAL }}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Product-style illustration of Jova at work */}
            <div className="rounded-[var(--ld-radius)] border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4" style={{ color: TEAL }} />
                Jova found 3 things requiring your attention
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/80">
                {[
                  "Employment document requires review",
                  "Data protection obligation requires verification",
                  "Supplier agreement expires in 21 days",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-lg bg-white/[0.06] px-3 py-2.5 text-sm text-white/60">
                Ask Jova:{" "}
                <span className="text-white">
                  What should I deal with first?
                </span>
              </div>
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-xs leading-relaxed">
                {[
                  [
                    "What happened",
                    "Your supplier agreement with Acme Logistics reaches its renewal date in 21 days.",
                  ],
                  [
                    "Why it matters",
                    "It auto-renews for 12 months unless notice is given 14 days before renewal.",
                  ],
                  [
                    "What to do",
                    "Review the renewal terms this week; give notice by the 7th if you want to renegotiate.",
                  ],
                  [
                    "Source",
                    "Contracts register - Acme Logistics Services Agreement, renewal clause",
                  ],
                ].map(([k, v]) => (
                  <p key={k}>
                    <span
                      className="font-semibold uppercase tracking-[0.08em]"
                      style={{ color: TEAL }}
                    >
                      {k}
                    </span>{" "}
                    <span className="text-white/75">{v}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Document creation */}
      <section id="documents" className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Documents
            </p>
            <h2 className="font-clash mt-4 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              From obligation to document.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-[var(--ld-body)]">
              Create business documents using the information Jojan One already
              understands about your organisation. Jova asks only what it needs,
              writes the draft, checks it and never invents facts about your
              company.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-medium">
              {[
                "Ask Jova",
                "Fill the gaps",
                "Generate",
                "Jova Policy Check",
                "Adopt",
                "Export PDF / DOCX",
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-[color:var(--ld-line)] bg-[var(--ld-panel)] px-3 py-1.5">
                    {step}
                  </span>
                  {i < arr.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--ld-muted)]" />
                  )}
                </span>
              ))}
            </div>
            <p className="mt-8 text-sm leading-relaxed text-[var(--ld-body)]">
              Employee handbooks, privacy and data protection policies, HR
              policies, governance records, contracts and letters - each with
              the review wording it should carry, and a clean, document-control
              export once adopted.
            </p>
          </div>

          {/* Document-style output, not chat text */}
          <div className="ld-surface relative overflow-hidden rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-8">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-red-600">
              Draft - review before use
            </p>
            <h3 className="font-clash mt-3 text-2xl font-semibold tracking-[-0.02em]">
              Data Protection Policy
            </h3>
            <div className="mt-4 space-y-1.5 border-y border-[color:var(--ld-line)] py-3 text-xs text-[var(--ld-body)]">
              {[
                ["Version", "v1.0"],
                ["Owner", "Founder & CEO"],
                ["Effective date", "On adoption"],
                ["Next review", "12 months"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[var(--ld-muted)]">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-[var(--ld-body)]">
              <p className="font-semibold text-[var(--ld-ink)]">1. Purpose</p>
              <p>
                Explain how the organisation collects, uses and protects
                personal data...
              </p>
              <p className="font-semibold text-[var(--ld-ink)]">2. Scope</p>
              <p>
                This policy applies to all staff, contractors and volunteers
                acting on behalf of the business...
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
                style={{ backgroundColor: `${TEAL}1a`, color: TEAL }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Jova Policy Check
                passed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ld-line)] px-3 py-1 text-[var(--ld-body)]">
                <Download className="h-3.5 w-3.5" /> PDF · DOCX
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Capabilities */}
      <section
        id="capabilities"
        className="border-t border-[color:var(--ld-line)] bg-[var(--ld-panel)]"
      >
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="max-w-2xl">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Capabilities
            </p>
            <h2 className="font-clash mt-4 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              Everything a protected business needs, in one place.
            </h2>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((f) => (
              <div
                key={f.title}
                className={`ld-surface group flex flex-col rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-7 transition-transform duration-300 ${easing} hover:-translate-y-1`}
              >
                <div
                  className={`ld-well flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 ${easing} group-hover:rotate-[12deg]`}
                >
                  <f.icon
                    className="h-5 w-5 text-[var(--ld-ink)]"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="font-clash mt-6 text-xl font-semibold tracking-[-0.02em]">
                  {f.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--ld-body)]">
                  {f.desc}
                </p>
                <ArrowUpRight className="mt-5 h-5 w-5 text-[var(--ld-muted)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ld-ink)]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-28">
        <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
          How Jojan One works
        </p>
        <h2 className="font-clash mt-4 max-w-2xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-5xl">
          From first answers to provable readiness.
        </h2>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((s) => (
            <div
              key={s.n}
              className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-7"
            >
              <span className="font-clash text-4xl font-bold tracking-[-0.04em] text-[var(--ld-muted)]">
                {s.n}
              </span>
              <h3 className="font-clash mt-4 text-lg font-semibold tracking-[-0.02em]">
                {s.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ld-body)]">
                {s.d}
              </p>
            </div>
          ))}
          {/* Summary strip fills the eighth cell */}
          <div className="ld-surface flex items-center justify-center rounded-[var(--ld-radius)] bg-[var(--ld-invert-bg)] p-7 text-center text-[var(--ld-invert-ink)]">
            <p className="font-clash text-xl font-semibold leading-relaxed tracking-[-0.02em]">
              Understand → Monitor → Act → Evidence → Prove
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Built for */}
      <section className="border-t border-[color:var(--ld-line)] bg-[var(--ld-panel)]">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <h2 className="font-clash max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-5xl">
            Built for businesses that need clarity, not complexity.
          </h2>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BUILT_FOR.map((b) => (
              <div
                key={b.t}
                className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-7"
              >
                <h3 className="font-clash text-xl font-semibold tracking-[-0.02em]">
                  {b.t}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ld-body)]">
                  {b.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ About */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-28">
        <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
          About Jojan One
        </p>
        <h2 className="font-clash mt-4 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
          Business protection shouldn&apos;t require ten different systems.
        </h2>
        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <div className="space-y-5 text-base leading-relaxed text-[var(--ld-body)]">
            <p>
              Jojan One is an intelligent business protection platform designed
              to bring the essential layers of running a protected, compliant
              and investment-ready business together in one place.
            </p>
            <p>
              From compliance and risk to contracts, people, governance and data
              protection, Jojan One helps businesses understand their
              obligations, identify what needs attention, take action and
              maintain the evidence to prove it.
            </p>
            <p>
              At the centre of the platform is Jova, Jojan One&apos;s
              intelligent business assistant, which uses business context,
              regulatory intelligence and trusted sources to help organisations
              understand what matters and what to do next.
            </p>
            <p>
              Our vision is simple: make business protection understandable,
              actionable and accessible - wherever a business operates.
            </p>
          </div>
          <div className="space-y-4">
            <div className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-panel)] p-8">
              <h3 className="font-clash text-2xl font-semibold tracking-[-0.02em]">
                Our mission
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ld-body)]">
                To give every business the intelligence, tools and confidence to
                understand its obligations, manage its risks and prove its
                readiness.
              </p>
            </div>
            <div className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-panel)] p-8">
              <h3 className="font-clash text-2xl font-semibold tracking-[-0.02em]">
                Our vision
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ld-body)]">
                A world where business protection is continuous, intelligent and
                built into the way companies operate - rather than something
                they think about only when something goes wrong.
              </p>
            </div>
          </div>
        </div>

        {/* Our story */}
        <div id="story" className="mt-20 max-w-3xl">
          <h3 className="font-clash text-3xl font-semibold tracking-[-0.03em]">
            Our story
          </h3>
          <div className="mt-5 space-y-5 text-base leading-relaxed text-[var(--ld-body)]">
            <p>
              Jojan One was created from a simple observation: growing
              businesses are expected to manage increasingly complex
              responsibilities across compliance, contracts, employment,
              governance, data protection and risk - yet the information and
              tools needed to manage those responsibilities are often fragmented
              across different systems, advisers, documents and spreadsheets.
            </p>
            <p>
              Jojan One was built to bring those pieces together. Instead of
              businesses having to work out what applies to them, where their
              risks are and what evidence they need, Jojan One is designed as an
              intelligent protection layer around the business - continuously
              helping organisations understand, act and prove.
            </p>
            <p>
              What began with legal and compliance expertise is developing into
              a broader business intelligence platform built for businesses
              operating in an increasingly complex regulatory world.
            </p>
          </div>
        </div>

        {/* Founder */}
        <div
          id="founder"
          className="mt-20 grid gap-10 lg:grid-cols-[360px_1fr] lg:items-start"
        >
          <div className="ld-surface overflow-hidden rounded-[var(--ld-radius)]">
            <Image
              src="/assets/founder.png"
              alt="Anastasia Ayivor, Founder and CEO of Jojan One"
              width={720}
              height={1000}
              className="h-auto w-full object-cover"
            />
          </div>
          <div>
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Founder
            </p>
            <h3 className="font-clash mt-3 text-3xl font-semibold tracking-[-0.03em]">
              Anastasia Ayivor
            </h3>
            <p className="mt-1 text-sm font-medium text-[var(--ld-muted)]">
              Founder &amp; CEO, Jojan One
            </p>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--ld-body)]">
              <p>
                Anastasia Ayivor is the Founder and CEO of Jojan One, an
                AI-powered LegalTech and RegTech platform built to help
                businesses understand their obligations, manage risk and
                demonstrate their readiness.
              </p>
              <p>
                With an academic background in law, including an LLB and an LLM
                in Commercial Law, and professional experience across regulatory
                reporting, compliance and business advisory, Anastasia has
                worked closely with organisations navigating the practical
                challenges of governance, regulation, contracts and operational
                risk.
              </p>
              <p>
                Through that experience, she identified a recurring problem:
                small and growing businesses are expected to meet many of the
                same legal, regulatory and governance responsibilities as larger
                organisations, but often without dedicated legal, compliance or
                risk teams. Jojan One was created to close that gap.
              </p>
              <p>
                Anastasia&apos;s vision is to build Jojan One into a global
                business protection infrastructure that makes sophisticated
                compliance and risk intelligence accessible to businesses
                regardless of their size or location.
              </p>
            </div>
            <blockquote
              className="mt-8 border-l-2 pl-5"
              style={{ borderColor: TEAL }}
            >
              <p className="font-display text-lg italic leading-relaxed text-[var(--ld-ink)]">
                &quot;Businesses shouldn&apos;t have to wait until something
                goes wrong to discover what they should have been doing all
                along.&quot;
              </p>
              <footer className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--ld-muted)]">
                Anastasia Ayivor, Founder &amp; CEO
              </footer>
            </blockquote>
          </div>
        </div>

        {/* Leadership & Team */}
        <div id="team" className="mt-20">
          <h3 className="font-clash text-3xl font-semibold tracking-[-0.03em]">
            Leadership &amp; Team
          </h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((m) => (
              <div
                key={m.name}
                className="ld-surface flex items-center gap-5 rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-6"
              >
                {m.photo ? (
                  <Image
                    src={m.photo}
                    alt={m.name}
                    width={160}
                    height={160}
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover object-top"
                  />
                ) : (
                  <div className="ld-well flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl">
                    <span className="font-clash text-2xl font-semibold">
                      {m.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-clash text-lg font-semibold tracking-[-0.02em]">
                    {m.name}
                  </p>
                  <p className="text-sm text-[var(--ld-muted)]">{m.role}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ld-body)]">
                    {m.focus}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Trust Centre */}
      <section
        id="trust"
        className="border-t border-[color:var(--ld-line)] bg-[var(--ld-panel)]"
      >
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="max-w-2xl">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Trust Centre
            </p>
            <h2 className="font-clash mt-4 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              Built to be trusted with your business.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--ld-body)]">
              Everything below describes how the platform is actually built - we
              don&apos;t make security claims because they sound good.
            </p>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((c) => (
              <div
                key={c.t}
                className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-7"
              >
                <ShieldCheck className="h-5 w-5 text-[var(--ld-ink)]" />
                <h3 className="font-clash mt-4 text-lg font-semibold tracking-[-0.02em]">
                  {c.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ld-body)]">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-2xl">
          <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
            Pricing
          </p>
          <h2 className="font-clash mt-4 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            Simple, honest pricing.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ld-body)]">
            Safety notices, exports and professional-support escalation are
            always available - never behind a paywall.
          </p>
        </div>
        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`ld-surface flex flex-col rounded-[var(--ld-radius)] p-8 ${
                p.highlight
                  ? "bg-[var(--ld-invert-bg)] text-[var(--ld-invert-ink)]"
                  : "bg-[var(--ld-surface)] text-[var(--ld-ink)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-clash text-2xl font-semibold tracking-[-0.02em]">
                  {p.name}
                </h3>
                {p.highlight && (
                  <span className="rounded-full border border-[var(--ld-invert-ink)]/30 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--ld-invert-ink)]/80">
                    Most popular
                  </span>
                )}
              </div>
              <p className="font-clash mt-6 text-5xl font-bold tracking-[-0.04em]">
                {p.price}
                {p.price.startsWith("£") && (
                  <span
                    className={`text-base font-normal ${p.highlight ? "text-[var(--ld-invert-ink)]/60" : "text-[var(--ld-muted)]"}`}
                  >
                    {" "}
                    /mo
                  </span>
                )}
              </p>
              <p
                className={`mt-1 text-xs uppercase tracking-[0.1em] ${p.highlight ? "text-[var(--ld-invert-ink)]/60" : "text-[var(--ld-muted)]"}`}
              >
                {p.seats}
              </p>
              <p
                className={`mt-5 text-sm leading-relaxed ${p.highlight ? "text-[var(--ld-invert-ink)]/70" : "text-[var(--ld-body)]"}`}
              >
                {p.blurb}
              </p>
              <ul
                className={`mt-5 flex-1 space-y-2.5 text-sm ${p.highlight ? "text-[var(--ld-invert-ink)]/80" : "text-[var(--ld-body)]"}`}
              >
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-[var(--ld-invert-ink)]/60" : "text-[var(--ld-muted)]"}`}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 justify-center px-5 py-3 ${pillBtn} ${
                  p.highlight
                    ? "bg-[var(--ld-invert-ink)] text-[var(--ld-invert-bg)] hover:scale-[1.03]"
                    : "ld-btn-outline"
                }`}
              >
                {p.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-[var(--ld-muted)]">
          Plan feature allocation is configurable and being finalised -
          early-access workspaces currently include the full platform.
        </p>
      </section>

      {/* ------------------------------------------------------------------- CTA */}
      <section className="mx-auto max-w-7xl px-6 py-32 text-center">
        <h2 className="font-clash mx-auto max-w-4xl text-5xl font-bold leading-[0.92] tracking-[-0.05em] sm:text-7xl">
          Start proving it today.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--ld-body)]">
          Create your workspace in minutes. See your Business Confidence Score,
          and know exactly where you stand.
        </p>
        <Link
          href="/login"
          className={`ld-btn-primary mt-10 px-8 py-4 text-base ${pillBtn}`}
        >
          Get started
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* ---------------------------------------------------------------- Footer */}
      <footer style={{ backgroundColor: NAVY }} className="text-white/60">
        <div className="border-t border-white/5">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-5">
            <div className="max-w-xs">
              <span className="font-clash text-xl font-bold tracking-[-0.03em] text-white">
                Jojan One
              </span>
              <p className="mt-4 text-sm leading-relaxed">
                The Business Protection Operating System for SMEs. Protect your
                business, and prove it - guidance, not advice.
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs">
                <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Built with jurisdiction-aware protection at its core
              </p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-white/40">
                Product
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Capabilities", "#capabilities"],
                  ["Jova", "#jova"],
                  ["Business Confidence", "#confidence"],
                  ["Documents", "#documents"],
                  ["How it works", "#how-it-works"],
                  ["Pricing", "#pricing"],
                ].map(([l, h]) => (
                  <li key={h}>
                    <a href={h} className="transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-white/40">
                Company
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  ["About", "#about"],
                  ["Our story", "#story"],
                  ["Founder", "#founder"],
                  ["Leadership & Team", "#team"],
                ].map(([l, h]) => (
                  <li key={h}>
                    <a href={h} className="transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="mailto:hello@jojan.one"
                    className="transition-colors hover:text-white"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-white/40">
                Trust
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Trust Centre", "#trust"],
                  ["Security & isolation", "#trust"],
                  ["Responsible AI", "#trust"],
                ].map(([l, h]) => (
                  <li key={l}>
                    <a href={h} className="transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-white/40">
                Get started
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link
                    href="/login"
                    className="transition-colors hover:text-white"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="transition-colors hover:text-white"
                  >
                    Create your workspace
                  </Link>
                </li>
                <li className="flex items-center gap-2.5 pt-2">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  hello@jojan.one
                </li>
                <li className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  London, United Kingdom
                </li>
              </ul>
            </div>
          </div>
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/5 px-6 py-6 text-xs sm:flex-row">
            <p>© {new Date().getFullYear()} Jojan One. Guidance, not advice.</p>
            <p className="uppercase tracking-[0.12em]">
              Understand · Monitor · Act · Evidence · Prove
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
