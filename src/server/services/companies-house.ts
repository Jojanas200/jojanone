import { and, eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { companiesHouseCache } from "../db/schema";

// Companies House - honest, read-only enrichment. Public CH data is fetched
// from the official REST API and cached per workspace with a retrieval time, so
// every value we show can be labelled "Source: Companies House · retrieved X".
//
// The CH cache table is service-role-write only, so this module writes via
// adminDb (it lives outside app/, so it passes the adminDb-in-request-path
// guard). Route handlers authorise the workspace before calling in.
//
// Key configuration is optional: without COMPANIES_HOUSE_API_KEY we never call
// the API - cached data is still served, and the UI shows a "not connected"
// state. Drop the key into the environment to go live.

const BASE = "https://api.company-information.service.gov.uk";
export const CH_PUBLIC_BASE =
  "https://find-and-update.company-information.service.gov.uk";

export type ChResource = "profile" | "officers" | "filing_history";
export const CH_RESOURCES: ChResource[] = [
  "profile",
  "officers",
  "filing_history",
];

// Cache lifetime before a value is considered stale (still served, flagged).
const TTL_MS = 24 * 60 * 60 * 1000;

const CH_PATH: Record<ChResource, string> = {
  profile: "",
  officers: "/officers",
  filing_history: "/filing-history",
};

export const isConfigured = () => !!process.env.COMPANIES_HOUSE_API_KEY;

// Normalise "12345678" / "sc123456" etc. - CH numbers are 8 chars, upper-cased.
export function normaliseCompanyNumber(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9]{6,10}$/.test(cleaned) ? cleaned : null;
}

export class CompaniesHouseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchResource(
  companyNumber: string,
  resource: ChResource,
): Promise<unknown> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new CompaniesHouseError("not configured", 503);

  const url = `${BASE}/company/${encodeURIComponent(companyNumber)}${CH_PATH[resource]}`;
  const res = await fetch(url, {
    headers: {
      // CH uses HTTP Basic with the API key as the username and a blank password.
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      Accept: "application/json",
    },
  });
  if (res.status === 404)
    throw new CompaniesHouseError("company not found", 404);
  if (res.status === 429)
    throw new CompaniesHouseError("rate limited by Companies House", 429);
  if (!res.ok)
    throw new CompaniesHouseError(
      `Companies House returned ${res.status}`,
      res.status,
    );
  return res.json();
}

export interface CachedResource {
  resource: ChResource;
  data: unknown;
  fetchedAt: Date | null;
  stale: boolean;
  source: "cache" | "live" | "unavailable";
}

async function readCache(
  workspaceId: string,
  companyNumber: string,
  resource: ChResource,
) {
  const rows = await adminDb
    .select({
      data: companiesHouseCache.data,
      fetchedAt: companiesHouseCache.fetchedAt,
    })
    .from(companiesHouseCache)
    .where(
      and(
        eq(companiesHouseCache.workspaceId, workspaceId),
        eq(companiesHouseCache.companyNumber, companyNumber),
        eq(companiesHouseCache.resource, resource),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function writeCache(
  workspaceId: string,
  companyNumber: string,
  resource: ChResource,
  data: unknown,
) {
  // Manual upsert on the (workspace, company, resource) unique key.
  const existing = await readCache(workspaceId, companyNumber, resource);
  if (existing) {
    await adminDb
      .update(companiesHouseCache)
      .set({ data, fetchedAt: new Date() })
      .where(
        and(
          eq(companiesHouseCache.workspaceId, workspaceId),
          eq(companiesHouseCache.companyNumber, companyNumber),
          eq(companiesHouseCache.resource, resource),
        ),
      );
  } else {
    await adminDb
      .insert(companiesHouseCache)
      .values({ workspaceId, companyNumber, resource, data });
  }
}

/**
 * Get one CH resource: serve fresh cache, else fetch + cache. On fetch failure
 * fall back to stale cache if we have it. `forceRefresh` bypasses fresh cache.
 */
export async function getResource(
  workspaceId: string,
  companyNumber: string,
  resource: ChResource,
  forceRefresh = false,
): Promise<CachedResource> {
  const cached = await readCache(workspaceId, companyNumber, resource);
  const fresh =
    cached && Date.now() - new Date(cached.fetchedAt).getTime() < TTL_MS;

  if (cached && fresh && !forceRefresh) {
    return {
      resource,
      data: cached.data,
      fetchedAt: cached.fetchedAt,
      stale: false,
      source: "cache",
    };
  }

  try {
    const data = await fetchResource(companyNumber, resource);
    await writeCache(workspaceId, companyNumber, resource, data);
    return {
      resource,
      data,
      fetchedAt: new Date(),
      stale: false,
      source: "live",
    };
  } catch (err) {
    // Fetch failed (not configured / rate limited / down): serve stale if any.
    if (cached) {
      return {
        resource,
        data: cached.data,
        fetchedAt: cached.fetchedAt,
        stale: true,
        source: "cache",
      };
    }
    if (err instanceof CompaniesHouseError && err.status === 404) throw err;
    return {
      resource,
      data: null,
      fetchedAt: null,
      stale: false,
      source: "unavailable",
    };
  }
}

export interface CompanyLookup {
  companyNumber: string;
  configured: boolean;
  resources: Record<ChResource, CachedResource>;
  publicUrl: string;
  filingHistoryUrl: string;
}

/** Fetch all three resources for a company (used by the lookup page). */
export async function lookupCompany(
  workspaceId: string,
  companyNumber: string,
  forceRefresh = false,
): Promise<CompanyLookup> {
  const [profile, officers, filing] = await Promise.all(
    CH_RESOURCES.map((r) =>
      getResource(workspaceId, companyNumber, r, forceRefresh),
    ),
  );
  return {
    companyNumber,
    configured: isConfigured(),
    resources: { profile, officers, filing_history: filing },
    publicUrl: `${CH_PUBLIC_BASE}/company/${companyNumber}`,
    filingHistoryUrl: `${CH_PUBLIC_BASE}/company/${companyNumber}/filing-history`,
  };
}
