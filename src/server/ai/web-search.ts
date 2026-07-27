import { adminDb } from "../db/admin";
import { jovaWebSearches } from "../db/schema";
import { getPlatformSettings } from "../services/platform-settings";

// Controlled, read-only web search for Jova.
//
// Design constraints (from the project owner):
// - Search only. This module can query a search API and return result
//   metadata; it cannot fetch arbitrary pages, submit forms, make payments,
//   file documents or take ANY external action.
// - Server-side only: API keys live in env vars and never reach the client.
// - Trusted official sources are prioritised; in strict mode (the default)
//   anything off the allowlist is dropped.
// - Queries are redacted before leaving the platform: emails, phone numbers,
//   NI numbers, postcodes and long digit runs are stripped.
// - Every result carries publisher, link and date accessed for display.
// - Searches are logged (redacted query + result domains only - no personal
//   data) to a service-role-only audit table.
// - The whole feature sits behind the "jova_web_search" platform flag,
//   DISABLED by default. While disabled Jova must not be represented as
//   internet-connected.

export const WEB_SEARCH_FLAG = "jova_web_search";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Hostname shown as the publisher (e.g. www.gov.uk). */
  publisher: string;
  /** ISO date the result was retrieved. */
  accessedAt: string;
  trusted: boolean;
}

export interface WebSearchProvider {
  name: string;
  isConfigured(): boolean;
  search(query: string, maxResults: number): Promise<WebSearchResult[]>;
}

// Official / regulator domains, by suffix match. UK first (GOV.UK covers
// HMRC, Companies House and HSE), then international official sources -
// Jojan One serves businesses outside the UK too.
export const TRUSTED_DOMAINS: string[] = [
  // United Kingdom
  "gov.uk", // GOV.UK, HMRC, Companies House, HSE (hse.gov.uk), DBT...
  "ico.org.uk",
  "acas.org.uk",
  "fca.org.uk",
  "legislation.gov.uk",
  "nidirect.gov.uk",
  "gov.scot",
  "gov.wales",
  "bankofengland.co.uk",
  // European Union
  "europa.eu", // EUR-Lex, EDPB, European Commission
  "edpb.europa.eu",
  "cnil.fr",
  "dataprotection.ie",
  // United States
  "irs.gov",
  "sec.gov",
  "ftc.gov",
  "dol.gov",
  "osha.gov",
  "sba.gov",
  // Canada / Australia / New Zealand
  "canada.ca",
  "gc.ca",
  "gov.au",
  "govt.nz",
  // International bodies
  "oecd.org",
  "un.org",
  "ilo.org",
  "iso.org",
  "wto.org",
];

export function isTrustedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Strip personal / confidential tokens before a query leaves the platform:
 * emails, phone numbers, UK NI numbers, postcodes, and digit runs that look
 * like account or company numbers.
 */
export function redactQuery(query: string): string {
  return query
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[redacted]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted]")
    .replace(
      /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi,
      "[redacted]",
    )
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[redacted]")
    .replace(/\b[A-Z]{0,3}\d{6,}[A-Z]{0,3}\b/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

const today = () => new Date().toISOString().slice(0, 10);

const toResult = (
  title: string,
  url: string,
  snippet: string,
): WebSearchResult => {
  let publisher = "";
  try {
    publisher = new URL(url).hostname;
  } catch {
    publisher = url;
  }
  return {
    title: title.slice(0, 200),
    url,
    snippet: snippet.replace(/\s+/g, " ").trim().slice(0, 400),
    publisher,
    accessedAt: today(),
    trusted: isTrustedUrl(url),
  };
};

// --- Providers ---------------------------------------------------------------

const braveProvider: WebSearchProvider = {
  name: "brave",
  isConfigured: () => !!process.env.BRAVE_SEARCH_API_KEY,
  async search(query, maxResults) {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
        },
      },
    );
    if (!res.ok) throw new Error(`brave search: ${res.status}`);
    const data = (await res.json()) as {
      web?: {
        results?: { title: string; url: string; description?: string }[];
      };
    };
    return (data.web?.results ?? []).map((r) =>
      toResult(r.title, r.url, r.description ?? ""),
    );
  },
};

const tavilyProvider: WebSearchProvider = {
  name: "tavily",
  isConfigured: () => !!process.env.TAVILY_API_KEY,
  async search(query, maxResults) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_domains: TRUSTED_DOMAINS,
      }),
    });
    if (!res.ok) throw new Error(`tavily search: ${res.status}`);
    const data = (await res.json()) as {
      results?: { title: string; url: string; content?: string }[];
    };
    return (data.results ?? []).map((r) =>
      toResult(r.title, r.url, r.content ?? ""),
    );
  },
};

const offProvider: WebSearchProvider = {
  name: "off",
  isConfigured: () => false,
  async search() {
    return [];
  },
};

export function getWebSearchProvider(): WebSearchProvider {
  const which = (process.env.WEB_SEARCH_PROVIDER ?? "off").toLowerCase();
  if (which === "brave") return braveProvider;
  if (which === "tavily") return tavilyProvider;
  return offProvider;
}

// --- The single entry point Jova uses ---------------------------------------

export interface TrustedSearchOutcome {
  enabled: boolean;
  results: WebSearchResult[];
}

/**
 * Flag-gated, redacted, allowlist-filtered search. Returns enabled:false
 * without touching the network when the platform flag is off or no provider
 * is configured.
 */
export async function searchTrusted(
  workspaceId: string,
  query: string,
  opts?: { provider?: WebSearchProvider; maxResults?: number },
): Promise<TrustedSearchOutcome> {
  const settings = await getPlatformSettings();
  const enabled = settings.featureFlags[WEB_SEARCH_FLAG] === true;
  const provider = opts?.provider ?? getWebSearchProvider();
  if (!enabled || !provider.isConfigured())
    return { enabled: false, results: [] };

  const redacted = redactQuery(query);
  if (!redacted) return { enabled: true, results: [] };

  let results: WebSearchResult[] = [];
  try {
    results = (await provider.search(redacted, opts?.maxResults ?? 6))
      .filter((r) => r.trusted) // strict mode: official sources only
      .slice(0, 5);
  } catch {
    results = []; // search failure must never break the answer
  }

  // Audit trail: redacted query + result domains only, no personal data.
  try {
    await adminDb.insert(jovaWebSearches).values({
      workspaceId,
      redactedQuery: redacted,
      provider: provider.name,
      resultCount: results.length,
      resultDomains: [...new Set(results.map((r) => r.publisher))],
    });
  } catch {
    // logging is best-effort
  }

  return { enabled: true, results };
}
