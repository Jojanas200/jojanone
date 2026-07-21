import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClaims } from "@/server/auth/session";
import { setUserTheme, normaliseTheme } from "@/server/services/prefs";

// Persist the signed-in user's theme so it follows them across devices. Also
// mirrors the value into the (non-httpOnly) jj-theme cookie, which the root
// layout's no-flash script reads on a fresh device.
export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    theme?: string;
  } | null;
  const theme = normaliseTheme(body?.theme);
  await setUserTheme(claims, theme);

  (await cookies()).set("jj-theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true, theme });
}
