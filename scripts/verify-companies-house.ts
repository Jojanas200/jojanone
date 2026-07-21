/**
 * Verifies the Companies House integration with a MOCKED fetch (no real API
 * key needed): caching, fresh-vs-refresh, not-configured fallback to stale
 * cache, 404 handling, and RLS scoping of the per-workspace cache.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-companies-house.ts
 */
import { and, eq, inArray } from "drizzle-orm";
import { adminDb, withUser } from "../src/server/db";
import {
  companiesHouseCache,
  organisations,
  workspaces,
} from "../src/server/db/schema";
import {
  CompaniesHouseError,
  getResource,
  lookupCompany,
  normaliseCompanyNumber,
} from "../src/server/services/companies-house";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
async function createUser(email: string): Promise<string> {
  const res = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Test-Passw0rd!",
      email_confirm: true,
    }),
  });
  if (!res.ok) throw new Error(`createUser: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; user?: { id: string } };
  const id = data.id ?? data.user?.id;
  if (!id) throw new Error("createUser: no id");
  return id;
}
const deleteUser = (id: string) =>
  adminFetch(`/users/${id}`, { method: "DELETE" });

// Canned CH responses + a call counter, installed only for the CH section.
const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
let chCalls = 0;
const mockFetch = async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input);
  chCalls++;
  if (url.includes("SC404040")) return new Response("", { status: 404 });
  if (url.endsWith("/officers"))
    return json({
      items: [
        {
          name: "SMITH, John",
          officer_role: "director",
          appointed_on: "2020-01-01",
        },
      ],
    });
  if (url.endsWith("/filing-history"))
    return json({
      items: [
        {
          date: "2025-01-01",
          type: "CS01",
          description: "confirmation-statement",
        },
      ],
    });
  return json({
    company_name: "ACME LTD",
    company_number: "12345678",
    company_status: "active",
    type: "ltd",
    date_of_creation: "2020-01-01",
  });
};

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";
  let wsA = "";
  let wsB = "";
  const realFetch = globalThis.fetch;

  try {
    // --- Pure helpers --------------------------------------------------------
    check(
      "normalise 8-digit number",
      normaliseCompanyNumber("12345678") === "12345678",
    );
    check(
      "normalise trims + upper-cases",
      normaliseCompanyNumber(" sc123456 ") === "SC123456",
    );
    check("normalise rejects junk", normaliseCompanyNumber("!!") === null);

    // Real fetch still needed to create users / provision workspaces.
    userA = await createUser(`vch-a-${stamp}@example.test`);
    userB = await createUser(`vch-b-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VCh A", workspaceName: "VCh A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "VCh B", workspaceName: "VCh B" },
    );

    // Install the mock + a fake key for the CH section.
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    process.env.COMPANIES_HOUSE_API_KEY = "test-key";

    // First fetch is live and cached.
    const before = chCalls;
    const p1 = await getResource(wsA, "12345678", "profile");
    check("first lookup is live", p1.source === "live");
    check(
      "profile data parsed",
      (p1.data as { company_name?: string })?.company_name === "ACME LTD",
    );
    check("a network call was made", chCalls === before + 1);

    // Second lookup (fresh, no refresh) is served from cache, no network call.
    const afterFirst = chCalls;
    const p2 = await getResource(wsA, "12345678", "profile");
    check(
      "second lookup served from cache",
      p2.source === "cache" && !p2.stale,
    );
    check("no extra network call for cached read", chCalls === afterFirst);

    // Forced refresh re-fetches.
    const p3 = await getResource(wsA, "12345678", "profile", true);
    check(
      "refresh re-fetches (live)",
      p3.source === "live" && chCalls === afterFirst + 1,
    );

    // Full lookup returns all three resources.
    const full = await lookupCompany(wsA, "12345678");
    check(
      "lookup returns officers + filing history",
      (full.resources.officers.data as { items?: unknown[] })?.items?.length ===
        1 &&
        (full.resources.filing_history.data as { items?: unknown[] })?.items
          ?.length === 1,
    );
    check(
      "public deep-link is the official CH URL",
      full.publicUrl.includes(
        "find-and-update.company-information.service.gov.uk",
      ),
    );

    // RLS: the cache row is visible to A, invisible to B.
    const seenByA = await withUser({ sub: userA }, (tx) =>
      tx
        .select({ id: companiesHouseCache.id })
        .from(companiesHouseCache)
        .where(
          and(
            eq(companiesHouseCache.workspaceId, wsA),
            eq(companiesHouseCache.companyNumber, "12345678"),
          ),
        ),
    );
    const seenByB = await withUser({ sub: userB }, (tx) =>
      tx.select({ id: companiesHouseCache.id }).from(companiesHouseCache),
    );
    check("A can read its cached CH rows", seenByA.length >= 1);
    check("B cannot read A's cached CH rows (RLS)", seenByB.length === 0);

    // Not configured: stale cache is still served.
    delete process.env.COMPANIES_HOUSE_API_KEY;
    const stale = await getResource(wsA, "12345678", "profile", true);
    check(
      "without a key, stale cache is served",
      stale.source === "cache" && stale.stale,
    );

    // Not configured + no cache: unavailable (no throw).
    const missing = await getResource(wsA, "87654321", "profile");
    check(
      "unconfigured + uncached is 'unavailable'",
      missing.source === "unavailable" && missing.data === null,
    );

    // 404 from CH surfaces as an error when there's no cache to fall back on.
    process.env.COMPANIES_HOUSE_API_KEY = "test-key";
    let threw404 = false;
    try {
      await getResource(wsA, "SC404040", "profile");
    } catch (e) {
      threw404 = e instanceof CompaniesHouseError && e.status === 404;
    }
    check("404 from CH throws a 404 error", threw404);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.COMPANIES_HOUSE_API_KEY;
    console.log("Cleanup…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ids));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ids));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      if (userA) await deleteUser(userA);
      if (userB) await deleteUser(userB);
      console.log("  done");
    } catch (e) {
      console.log(`  cleanup warning: ${(e as Error).message}`);
    }
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
