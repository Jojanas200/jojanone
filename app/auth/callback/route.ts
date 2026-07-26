import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The single landing point for every email link - signup confirmation, magic
 * link, invite and password recovery. Supabase redirects here with either a
 * PKCE `code` (default templates) or a `token_hash` + `type` (token-hash
 * templates); we establish the session and forward the user on. Recovery always
 * lands on the set-new-password screen.
 *
 * The `redirect_to` used by the email links must point at this route, so the
 * app sets `emailRedirectTo` accordingly and the URL is added to Supabase's
 * Redirect URLs allow-list.
 */

// Only allow same-site relative destinations (no open redirect).
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

// Behind Vercel's proxy the request origin can be internal; prefer the
// forwarded host so redirects land on the public URL.
function baseUrl(request: Request, origin: string): string {
  if (process.env.NODE_ENV === "development") return origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return origin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const base = baseUrl(request, origin);

  const supabase = await createClient();

  let error: string | null = null;
  if (code) {
    error =
      (await supabase.auth.exchangeCodeForSession(code)).error?.message ?? null;
  } else if (tokenHash && type) {
    error =
      (await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
        ?.message ?? null;
  } else {
    error = "This link is missing its authentication code.";
  }

  if (error) {
    const dest = new URL("/login", base);
    dest.searchParams.set("error", error);
    return NextResponse.redirect(dest);
  }

  // Recovery must set a new password; the reset flow passes next accordingly,
  // and token-hash recovery links carry type=recovery too.
  const dest = type === "recovery" ? "/auth/reset/update" : next;
  return NextResponse.redirect(new URL(dest, base));
}
