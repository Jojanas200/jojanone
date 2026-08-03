/**
 * Marketing site content.
 *
 * The copy is authored as JSON (exported from the project owner's design) and
 * read from here by the pages, so editing the site is editing these files
 * rather than the components.
 *
 * Most shapes are inferred straight from the JSON. The exception is the legal
 * library: the Security page nests {heading, body} while the other five nest
 * {text}, so `legalPage()` normalises both into one shape the renderer can
 * take.
 */

import capabilitiesJson from "./capabilities.json";

import homeJson from "./home.json";
import aboutJson from "./about.json";
import contactJson from "./contact.json";
import founderJson from "./founder.json";
import guidesJson from "./guides.json";
import helpJson from "./help.json";
import howItWorksJson from "./how_it_works.json";
import ourStoryJson from "./our_story.json";
import teamJson from "./team.json";
import pricingJson from "./pricing.json";

import trustCentreJson from "./trust_centre.json";
import trustSecurityJson from "./trust_security.json";
import trustPrivacyJson from "./trust_privacy.json";
import trustTermsJson from "./trust_terms.json";
import trustCookiesJson from "./trust_cookies.json";
import trustAiJson from "./trust_ai.json";
import trustDpaJson from "./trust_dpa.json";

/** A capability's own page: what it is, what it does, what it is worth. */
export interface Capability {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  features: { id: string; title: string; description: string }[];
  benefits: { id: string; text: string }[];
}

export const capabilities = capabilitiesJson as Capability[];

export const home = homeJson;
export const about = aboutJson;
export const contact = contactJson;
export const founder = founderJson;
export const guides = guidesJson;
export const help = helpJson;
export const howItWorks = howItWorksJson;
export const ourStory = ourStoryJson;
export const pricingContent = pricingJson;
export const trustCentre = trustCentreJson;

/**
 * Leadership portraits live in the app's own asset folder; the export
 * referenced the design tool's CDN, which does not exist here.
 */
const PORTRAITS: Record<string, string> = {
  "Anastasia Ayivor": "/assets/founder.png",
  "Kwabena Osei-Tutu": "/assets/cto.png",
};

export const team = {
  ...teamJson,
  leadership: teamJson.leadership.map((person) => ({
    ...person,
    photo: PORTRAITS[person.name] ?? null,
  })),
};

// --- Legal library ---------------------------------------------------------

export interface LegalParagraph {
  id: string;
  heading?: string;
  text: string;
}

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: LegalParagraph[];
}

export interface LegalPage {
  hero: { eyebrow: string; title: string; subtitle: string };
  intro?: string;
  sections: LegalSection[];
  lastUpdated?: string;
  subprocessors?: {
    title: string;
    items: { id: string; name: string; purpose: string; location: string }[];
  };
}

type RawSection = {
  id: string;
  title: string;
  items?: { id: string; heading: string; body: string }[];
  body?: { id: string; text: string }[];
};

function legalPage(raw: {
  hero: { eyebrow: string; title: string; subtitle: string };
  intro?: string;
  sections: RawSection[];
  lastUpdated?: string;
  subprocessors?: LegalPage["subprocessors"];
}): LegalPage {
  return {
    hero: raw.hero,
    intro: raw.intro,
    lastUpdated: raw.lastUpdated,
    subprocessors: raw.subprocessors,
    sections: raw.sections.map((section) => ({
      id: section.id,
      title: section.title,
      paragraphs: section.items
        ? section.items.map((item) => ({
            id: item.id,
            heading: item.heading,
            text: item.body,
          }))
        : (section.body ?? []).map((item) => ({
            id: item.id,
            text: item.text,
          })),
    })),
  };
}

/** The six documents the Trust Centre indexes, by URL slug. */
export const TRUST_PAGES: Record<string, LegalPage> = {
  security: legalPage(trustSecurityJson),
  privacy: legalPage(trustPrivacyJson),
  terms: legalPage(trustTermsJson),
  cookies: legalPage(trustCookiesJson),
  ai: legalPage(trustAiJson),
  dpa: legalPage(trustDpaJson),
};

export const TRUST_SLUGS = Object.keys(TRUST_PAGES);

// --- Lookups ---------------------------------------------------------------

export function capabilityBySlug(slug: string): Capability | undefined {
  return capabilities.find((c) => c.slug === slug);
}

/**
 * The home page names capabilities rather than linking them, so its cards are
 * matched back to their pages by name. A name with no page simply does not
 * link - better a plain card than a 404.
 */
export function capabilityHrefByName(name: string): string | null {
  const match = capabilities.find((c) => c.name === name);
  return match ? `/capabilities/${match.slug}` : null;
}

/**
 * The exported copy links to a few slugs this site does not use. Rewriting
 * them here keeps the content faithful to what the owner wrote while making
 * sure no link on the site 404s.
 */
const HREF_FIXES: Record<string, string> = {
  "/capabilities/risk-intelligence": "/capabilities/risk-management",
  "/trust/data-processing": "/trust/dpa",
  "/trust/ai-transparency": "/trust/ai",
  "/get-started": "/login",
};

export function siteHref(href: string): string {
  const [path, query] = href.split("?");
  const fixed = HREF_FIXES[path] ?? path;
  return query ? `${fixed}?${query}` : fixed;
}
