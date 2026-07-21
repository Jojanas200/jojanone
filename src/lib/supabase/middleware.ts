import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths the middleware never redirects to /login. `/api` is included because
// Route Handlers enforce their own auth and must return 401 JSON (not an HTML
// redirect) to unauthenticated fetches. `/invite` renders its own sign-in
// prompt. The public marketing landing lives at exactly "/" (handled below).
const NO_REDIRECT_PREFIXES = ["/login", "/auth", "/api", "/invite"];

/** Refresh the Supabase session cookie and guard routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const noRedirect =
    path === "/" || NO_REDIRECT_PREFIXES.some((p) => path.startsWith(p));

  if (!user && !noRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
