/**
 * End-to-end verification of Jova's controlled web search against the REAL
 * Supabase project: query redaction, trusted-domain allowlisting, the
 * platform flag defaulting OFF (no provider call), flag-on behaviour with a
 * stubbed provider (strict filtering, provenance, audit logging without
 * personal data), and ask() integration (web citations with URLs). The flag
 * is restored and everything cleaned up afterwards.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-jova-web.ts
 */
import { eq, inArray, sql } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  jovaSources,
  jovaWebSearches,
  organisations,
  platformSettings,
  workspaces,
} from "../src/server/db/schema";
import { provisionWorkspace } from "../src/server/services/provisioning";
import { clearPlatformSettingsCache } from "../src/server/services/platform-settings";
import {
  isTrustedUrl,
  redactQuery,
  searchTrusted,
  type WebSearchProvider,
} from "../src/server/ai/web-search";
import { ask } from "../src/server/ai/chat";
import { providerFor } from "../src/server/ai/provider";

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

async function setWebFlag(value: boolean | null) {
  // Merge/unset the flag directly on the singleton row, then drop the cache.
  await adminDb
    .update(platformSettings)
    .set({
      featureFlags:
        value === null
          ? sql`(${platformSettings.featureFlags} - 'jova_web_search')`
          : sql`(${platformSettings.featureFlags} || jsonb_build_object('jova_web_search', ${value}::boolean))`,
    })
    .where(eq(platformSettings.id, "singleton"));
  clearPlatformSettingsCache();
}

function stubProvider(calls: { count: number }): WebSearchProvider {
  return {
    name: "stub",
    isConfigured: () => true,
    async search(query: string) {
      calls.count += 1;
      void query;
      return [
        {
          title: "Data protection for small organisations",
          url: "https://ico.org.uk/for-organisations/sme-web-hub/",
          snippet: "ICO guidance for small businesses.",
          publisher: "ico.org.uk",
          accessedAt: new Date().toISOString().slice(0, 10),
          trusted: isTrustedUrl("https://ico.org.uk/for-organisations/"),
        },
        {
          title: "File your confirmation statement",
          url: "https://www.gov.uk/file-your-confirmation-statement-with-companies-house",
          snippet: "Companies House filing guidance.",
          publisher: "www.gov.uk",
          accessedAt: new Date().toISOString().slice(0, 10),
          trusted: isTrustedUrl("https://www.gov.uk/"),
        },
        {
          title: "10 compliance hacks",
          url: "https://random-blog.example.com/hacks",
          snippet: "Unofficial blog content.",
          publisher: "random-blog.example.com",
          accessedAt: new Date().toISOString().slice(0, 10),
          trusted: isTrustedUrl("https://random-blog.example.com/hacks"),
        },
      ];
    },
  };
}

async function main() {
  const stamp = Date.now();
  let userA = "";
  let wsA = "";
  let flagTouched = false;

  try {
    // --- Redaction -----------------------------------------------------------
    const redacted = redactQuery(
      "Email jane.doe@acme.co.uk or call 07700 900123, NI QQ123456C, postcode SW1A 1AA, company 12345678 - confirmation statement deadline?",
    );
    check(
      "emails, phones, NI numbers, postcodes and long digits are redacted",
      !redacted.includes("jane.doe") &&
        !redacted.includes("07700") &&
        !/QQ\s?12/i.test(redacted) &&
        !/SW1A/i.test(redacted) &&
        !redacted.includes("12345678") &&
        redacted.includes("confirmation statement"),
    );

    // --- Trusted-domain allowlist -------------------------------------------
    check(
      "official domains are trusted (GOV.UK, HSE, ICO, EU, IRS)",
      isTrustedUrl("https://www.gov.uk/vat-registration") &&
        isTrustedUrl("https://www.hse.gov.uk/simple-health-safety/") &&
        isTrustedUrl("https://ico.org.uk/for-organisations/") &&
        isTrustedUrl("https://commission.europa.eu/law") &&
        isTrustedUrl("https://www.irs.gov/businesses"),
    );
    check(
      "lookalike and unofficial domains are not trusted",
      !isTrustedUrl("https://gov.uk.evil.example.com/") &&
        !isTrustedUrl("https://notgov.uk/") &&
        !isTrustedUrl("https://random-blog.example.com/"),
    );

    userA = await createUser(`vjw-a-${stamp}@example.test`);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "VJW A", workspaceName: "VJW A" },
    );

    // --- Flag OFF by default: provider is never touched ----------------------
    const offCalls = { count: 0 };
    const off = await searchTrusted(wsA, "vat thresholds", {
      provider: stubProvider(offCalls),
    });
    check(
      "flag off by default: search disabled, provider never called",
      off.enabled === false && off.results.length === 0 && offCalls.count === 0,
    );

    // --- Flag ON: strict filtering, provenance, audit log --------------------
    await setWebFlag(true);
    flagTouched = true;
    const onCalls = { count: 0 };
    const on = await searchTrusted(
      wsA,
      "confirmation statement deadline for jane.doe@acme.co.uk",
      { provider: stubProvider(onCalls) },
    );
    check(
      "flag on: trusted results only (untrusted blog dropped)",
      on.enabled === true &&
        on.results.length === 2 &&
        on.results.every((r) => r.trusted),
    );
    check(
      "results carry publisher, link and date accessed",
      on.results.every(
        (r) =>
          r.publisher.length > 0 &&
          r.url.startsWith("https://") &&
          !!r.accessedAt,
      ),
    );
    const audit = await adminDb
      .select()
      .from(jovaWebSearches)
      .where(eq(jovaWebSearches.workspaceId, wsA));
    check(
      "search audited with redacted query and result domains only",
      audit.length === 1 &&
        !audit[0].redactedQuery.includes("jane.doe") &&
        audit[0].resultDomains.includes("ico.org.uk") &&
        audit[0].resultCount === 2,
    );

    // --- ask() integration: web citations with URLs --------------------------
    const askCalls = { count: 0 };
    const result = await ask(
      { sub: userA },
      wsA,
      { question: "When is my confirmation statement due?" },
      {
        provider: providerFor("deterministic"),
        webSearch: stubProvider(askCalls),
      },
    );
    const webSources = result.sources.filter((s) => s.module === "web");
    check(
      "answer cites distinct web sources with URLs",
      webSources.length === 2 &&
        webSources.every((s) => !!s.url?.startsWith("https://")),
    );
    const storedWeb = await adminDb
      .select({ url: jovaSources.url })
      .from(jovaSources)
      .where(inArray(jovaSources.sourceModule, ["web"]))
      .then((rows) => rows.filter((r) => !!r.url));
    check("web citations persisted with their links", storedWeb.length >= 2);

    // --- Disable again: feature fully off ------------------------------------
    await setWebFlag(null);
    flagTouched = false;
    const backOffCalls = { count: 0 };
    const backOff = await searchTrusted(wsA, "vat thresholds", {
      provider: stubProvider(backOffCalls),
    });
    check(
      "disabling the flag turns the feature fully off again",
      backOff.enabled === false && backOffCalls.count === 0,
    );
  } finally {
    console.log("Cleanup…");
    try {
      if (flagTouched) await setWebFlag(null);
      if (wsA) {
        await adminDb
          .delete(jovaWebSearches)
          .where(eq(jovaWebSearches.workspaceId, wsA));
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(eq(workspaces.id, wsA));
        await adminDb.delete(workspaces).where(eq(workspaces.id, wsA));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      if (userA) await deleteUser(userA);
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
