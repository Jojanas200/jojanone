/**
 * Verifies the public marketing site without needing a running server:
 *  - every route the site advertises exists as a page under app/(site);
 *  - every internal link in the content JSON and the nav config resolves,
 *    after siteHref() has rewritten the slugs the export got wrong;
 *  - the content carries no em dashes, non-breaking spaces or ellipses;
 *  - the middleware's marketing allowlist covers every page that exists, so a
 *    public page can never be redirected to /login;
 *  - the capability names the home page uses all match a capability page.
 *
 * Run: ./node_modules/.bin/tsx scripts/verify-site.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  capabilities,
  capabilityHrefByName,
  home,
  siteHref,
  TRUST_SLUGS,
} from "../src/content/site";
import { isMarketingPath } from "../src/shared/site/routes";
import { FOOTER_NAV, PRIMARY_NAV } from "../app/(site)/nav";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

const SITE_DIR = join(process.cwd(), "app", "(site)");
const CONTENT_DIR = join(process.cwd(), "src", "content", "site");

/** Every route app/(site) actually serves, with [slug] expanded. */
function routesOnDisk(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === "page.tsx") {
        const rel = relative(SITE_DIR, dir).split(sep).filter(Boolean);
        routes.add("/" + rel.join("/"));
      }
    }
  };
  walk(SITE_DIR);
  routes.delete("/");
  routes.add("/");

  // Expand the two dynamic segments from the content that fills them.
  if (routes.delete("/capabilities/[slug]"))
    for (const c of capabilities) routes.add(`/capabilities/${c.slug}`);
  if (routes.delete("/trust/[slug]"))
    for (const s of TRUST_SLUGS) routes.add(`/trust/${s}`);

  return routes;
}

/** Every internal href the site renders, drawn from content and nav config. */
function linksInContent(): Map<string, string> {
  const links = new Map<string, string>();
  const add = (href: string, source: string) => {
    if (!href.startsWith("/")) return;
    links.set(siteHref(href), source);
  };

  for (const item of PRIMARY_NAV) add(item.href, "PRIMARY_NAV");
  for (const column of FOOTER_NAV)
    for (const link of column.links) add(link.href, `footer:${column.heading}`);

  for (const file of readdirSync(CONTENT_DIR).filter((f) =>
    f.endsWith(".json"),
  )) {
    const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
    for (const match of raw.matchAll(/"(?:href|ctaHref)":\s*"(\/[^"]*)"/g)) {
      add(match[1].split("?")[0], file);
    }
  }
  return links;
}

function main() {
  const routes = routesOnDisk();
  const links = linksInContent();

  console.log(`\nRoutes on disk (${routes.size}):`);
  console.log("  " + [...routes].sort().join("\n  "));

  console.log(`\nInternal links (${links.size}):`);
  // /login is the product's own entrance, not a marketing page.
  const external = new Set(["/login"]);
  const broken: string[] = [];
  for (const [href, source] of [...links].sort()) {
    const ok = routes.has(href) || external.has(href);
    if (!ok) broken.push(`${href} (from ${source})`);
    console.log(`  ${ok ? "ok " : "BAD"} ${href}`);
  }
  check(
    `every internal link resolves${broken.length ? `: ${broken.join(", ")}` : ""}`,
    broken.length === 0,
  );

  // The middleware decides which paths are public. A page it does not cover
  // would 302 to /login for every visitor.
  const unguarded = [...routes].filter((route) => !isMarketingPath(route));
  check(
    `middleware treats every site route as public${unguarded.length ? `: ${unguarded.join(", ")}` : ""}`,
    unguarded.length === 0,
  );

  // ...and it must not hand app routes to the marketing host.
  check(
    "middleware does not treat app routes as public",
    !isMarketingPath("/dashboard") &&
      !isMarketingPath("/admin") &&
      !isMarketingPath("/settings") &&
      !isMarketingPath("/aboutus"),
  );

  const unnamed = home.capabilities.items.filter(
    (item) => capabilityHrefByName(item.name) === null,
  );
  check(
    `every capability the home page names has a page${unnamed.length ? `: ${unnamed.map((u) => u.name).join(", ")}` : ""}`,
    unnamed.length === 0,
  );

  check(
    "every capability has features and benefits",
    capabilities.every((c) => c.features.length > 0 && c.benefits.length > 0),
  );

  // House style: en dashes are fine, em dashes are not. Non-breaking spaces
  // and ellipsis characters came in with the export and read as typos.
  const dirty: string[] = [];
  for (const file of readdirSync(CONTENT_DIR).filter((f) =>
    f.endsWith(".json"),
  )) {
    const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
    const found = raw.match(/[— …]/g);
    if (found) dirty.push(`${file} (${new Set(found).size} kinds)`);
  }
  check(
    `content has no em dashes, non-breaking spaces or ellipses${dirty.length ? `: ${dirty.join(", ")}` : ""}`,
    dirty.length === 0,
  );

  check(
    "the trust library covers all six documents",
    TRUST_SLUGS.length === 6 &&
      ["security", "privacy", "terms", "cookies", "ai", "dpa"].every((s) =>
        TRUST_SLUGS.includes(s),
      ),
  );

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
