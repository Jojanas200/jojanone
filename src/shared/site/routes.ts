/**
 * The paths the public marketing site owns.
 *
 * Read by the middleware to split www.jojanone.com (marketing) from
 * app.jojanone.com (the product): anything not listed here is redirected to the
 * app host, which is what keeps the site's relative /login links working.
 *
 * Kept in src/shared so both the middleware (edge runtime) and the site's own
 * components can import it without one reaching into the other.
 */

export const MARKETING_ROOTS = [
  "/capabilities",
  "/how-it-works",
  "/about",
  "/pricing",
  "/contact",
  "/help",
  "/guides",
  "/trust",
] as const;

/** True for "/" and for any page beneath a marketing root. */
export function isMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
