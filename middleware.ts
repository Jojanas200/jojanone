import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isMarketingPath } from "@/shared/site/routes";

// Host-based routing: www.jojanone.com (and the apex) serve the public
// marketing site; every other path 308-redirects to app.jojanone.com, so the
// site's relative /login links keep working. app.jojanone.com's root goes
// straight to the app entrance (/dashboard guards to /login when signed out).
// Localhost and Vercel preview hosts match neither list and behave as before.
const APP_HOST = "app.jojanone.com";
const MARKETING_HOSTS = new Set(["jojanone.com", "www.jojanone.com"]);

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;

  if (MARKETING_HOSTS.has(host) && !isMarketingPath(pathname)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = APP_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  if (host === APP_HOST && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
