import Link from "next/link";
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
} from "lucide-react";
import { getClaims } from "@/server/auth/session";
import { BrandLogo } from "./BrandLogo";
import { ThemeSwitcher } from "./ThemeSwitcher";

export const metadata = {
  title: "Jojan One - Protect your business. Prove it.",
  description:
    "The UK small-business operating system for compliance, risk, contracts, HR, GDPR and governance - with Jova, your always-on protection intelligence.",
};

// Clash Display + Satoshi power the default (Swiss) theme; the Soft-UI theme
// swaps to Plus Jakarta Sans + DM Sans (loaded in the root layout).
const FONTSHARE =
  "https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700&display=swap";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Compliance",
    desc: "Every statutory and regulatory obligation tracked, with deadlines and evidence.",
  },
  {
    icon: AlertTriangle,
    title: "Risk",
    desc: "A living risk register with severity scoring and mitigation tracking.",
  },
  {
    icon: FileText,
    title: "Contracts",
    desc: "Key terms, renewals and risk flags across every agreement.",
  },
  {
    icon: Lock,
    title: "GDPR",
    desc: "Your processing register and data-protection duties, kept current.",
  },
  {
    icon: Building2,
    title: "Companies House",
    desc: "Official company data, honestly sourced and deep-linked to filing.",
  },
  {
    icon: TrendingUp,
    title: "Investor & Tender Ready",
    desc: "Due-diligence and bid readiness, maintained continuously.",
  },
  {
    icon: FileBarChart,
    title: "Reports & evidence",
    desc: "Board-ready packs and CSV exports for lenders, insurers and auditors.",
  },
  {
    icon: Sparkles,
    title: "Jova",
    desc: "Always-on intelligence that finds risk, explains it, and points to the fix.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "£39",
    seats: "1 seat",
    blurb: "For sole traders and micro-businesses getting protected.",
    highlight: false,
  },
  {
    name: "Growth",
    price: "£99",
    seats: "Up to 5 seats",
    blurb: "For growing teams that need to share the load.",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    seats: "Custom",
    blurb: "For larger organisations and advisers. Coming later.",
    highlight: false,
  },
];

const SCORE = [
  ["Compliance", 88],
  ["Risk", 74],
  ["People", 90],
  ["Data protection", 80],
] as const;

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
          <nav className="hidden items-center gap-9 md:flex">
            {[
              ["Capabilities", "#capabilities"],
              ["Approach", "#approach"],
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
          <div className="flex items-center gap-2.5">
            <ThemeSwitcher className="ld-btn-outline inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.06em]" />
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-[13px] uppercase tracking-[0.08em] text-[var(--ld-ink)] transition-colors duration-150 hover:text-[var(--ld-muted)] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="ld-btn-outline rounded-full px-5 py-2 text-[13px] uppercase tracking-[0.08em]"
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
            The UK small-business operating system
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
              Compliance, risk, contracts, HR, GDPR and governance in one place
              - with{" "}
              <span className="font-medium text-[var(--ld-ink)]">Jova</span>,
              your always-on protection intelligence, and a single Business
              Confidence Score.
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/login"
                className={`ld-btn-primary group px-6 py-3 ${pillBtn}`}
              >
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#capabilities"
                className={`ld-btn-outline px-6 py-3 ${pillBtn}`}
              >
                See what&apos;s inside
              </a>
            </div>
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.14em] text-[var(--ld-muted)]">
            No credit card to start &nbsp;·&nbsp; UK data residency (London)
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- Approach */}
      <section
        id="approach"
        className="border-t border-[color:var(--ld-line)] bg-[var(--ld-panel)]"
      >
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
                d: "Jova reasons only over your own data - never invented, never trained on. Every finding traces back to a source you can open.",
              },
              {
                t: "Honest",
                d: "Guidance to help you act, not regulated advice. Safety notices, exports and expert escalation are never behind a paywall.",
              },
              {
                t: "Yours",
                d: "UK data residency in London with strict per-workspace isolation. Your records stay your records.",
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

      {/* ------------------------------------------------------- Showcase (type) */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* One score - dark panel */}
          <div className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-invert-bg)] p-8 text-[var(--ld-invert-ink)] md:col-span-8 md:p-12">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-invert-ink)]/50">
              Business Confidence Score
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-8">
              <span className="font-clash text-[120px] font-bold leading-[0.8] tracking-[-0.05em]">
                82
              </span>
              <div className="mb-2 w-full max-w-xs space-y-3">
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
            <p className="mt-8 max-w-md text-sm leading-relaxed text-[var(--ld-invert-ink)]/60">
              One number that tells you - and anyone who asks - how protected
              your business is right now, across every module.
            </p>
          </div>

          {/* Pill-shaped vertical stat */}
          <div className="ld-surface flex flex-col justify-between rounded-full bg-[var(--ld-panel)] p-8 md:col-span-4">
            <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
              Connected
            </p>
            <div className="py-8 text-center">
              <span className="font-clash text-[110px] font-bold leading-none tracking-[-0.05em]">
                18
              </span>
              <p className="font-clash mt-2 text-2xl font-semibold tracking-[-0.02em]">
                modules
              </p>
            </div>
            <p className="text-center text-sm text-[var(--ld-body)]">
              Not eighteen spreadsheets.
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
                Reviews your business daily, surfaces what needs attention, and
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
              Everything a UK business needs to stay protected.
            </h2>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
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
      <section className="mx-auto max-w-7xl px-6 py-28">
        <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ld-muted)]">
          How it works
        </p>
        <h2 className="font-clash mt-4 max-w-2xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-5xl">
          Protected in three steps.
        </h2>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              n: "01",
              t: "Tell us about your business",
              d: "A short profile tailors your obligations, risks and reminders.",
            },
            {
              n: "02",
              t: "See your Confidence Score",
              d: "Jova reviews your data and shows exactly what needs attention.",
            },
            {
              n: "03",
              t: "Act - and keep the evidence",
              d: "Resolve issues, record proof, and stay ready for anyone who asks.",
            },
          ].map((s) => (
            <div
              key={s.n}
              className="ld-surface rounded-[var(--ld-radius)] bg-[var(--ld-surface)] p-8"
            >
              <span className="font-clash text-5xl font-bold tracking-[-0.04em] text-[var(--ld-muted)]">
                {s.n}
              </span>
              <h3 className="font-clash mt-5 text-xl font-semibold tracking-[-0.02em]">
                {s.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ld-body)]">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- Pricing */}
      <section
        id="pricing"
        className="border-t border-[color:var(--ld-line)] bg-[var(--ld-panel)]"
      >
        <div className="mx-auto max-w-7xl px-6 py-28">
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
                  className={`mt-5 flex-1 text-sm leading-relaxed ${p.highlight ? "text-[var(--ld-invert-ink)]/70" : "text-[var(--ld-body)]"}`}
                >
                  {p.blurb}
                </p>
                <Link
                  href="/login"
                  className={`mt-8 justify-center px-5 py-3 ${pillBtn} ${
                    p.highlight
                      ? "bg-[var(--ld-invert-ink)] text-[var(--ld-invert-bg)] hover:scale-[1.03]"
                      : "ld-btn-outline"
                  }`}
                >
                  {p.name === "Enterprise" ? "Talk to us" : "Get started"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
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
          Create your workspace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* ---------------------------------------------------------------- Footer */}
      <footer className="bg-[var(--ld-invert-bg)] text-[var(--ld-invert-ink)]/60">
        <div className="border-t border-white/5">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
            <div className="max-w-xs">
              <span className="font-clash text-xl font-bold tracking-[-0.03em] text-[var(--ld-invert-ink)]">
                Jojan One
              </span>
              <p className="mt-4 text-sm leading-relaxed">
                The UK small-business operating system. Protect your business,
                and prove it - guidance, not advice.
              </p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ld-invert-ink)]/40">
                Product
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Capabilities", "#capabilities"],
                  ["Approach", "#approach"],
                  ["Pricing", "#pricing"],
                ].map(([l, h]) => (
                  <li key={h}>
                    <a
                      href={h}
                      className="transition-colors hover:text-[var(--ld-invert-ink)]"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ld-invert-ink)]/40">
                Company
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link
                    href="/login"
                    className="transition-colors hover:text-[var(--ld-invert-ink)]"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="transition-colors hover:text-[var(--ld-invert-ink)]"
                  >
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ld-invert-ink)]/40">
                Contact
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  hello@jojan.one
                </li>
                <li className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  London, United Kingdom
                </li>
                <li className="flex items-center gap-2.5">
                  <ShieldCheck
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  UK data residency
                </li>
              </ul>
            </div>
          </div>
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/5 px-6 py-6 text-xs sm:flex-row">
            <p>© {new Date().getFullYear()} Jojan One. Guidance, not advice.</p>
            <p className="uppercase tracking-[0.12em]">
              Built on trust · Never trained on your data
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
