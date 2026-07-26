import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Stop impersonating: sign out the (impersonated) session and clear the flag.
// Deliberately NOT platform-admin gated - the active session is the target
// user, not the operator, so the operator signs back in as staff afterwards.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete("jj_impersonating");
  return NextResponse.json({ ok: true, redirect: "/login" });
}
