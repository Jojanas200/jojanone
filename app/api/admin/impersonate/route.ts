import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getWorkspaceOwner,
  logPlatformAction,
  requirePlatformAdmin,
} from "@/server/services/platform-admin";

// Start an AUDITED impersonation: the platform admin assumes the target
// workspace owner's session (via a server-minted magic-link OTP). A cookie
// flags the session so the app shows an impersonation banner. Powerful and
// fully logged - the operator can then act as that user until they stop.
export async function POST(req: Request) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );

  const body = (await req.json().catch(() => null)) as {
    workspaceId?: string;
    reason?: string;
  } | null;
  if (!body?.workspaceId)
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );
  const reason = body.reason?.trim();
  if (!reason || reason.length < 3)
    return NextResponse.json(
      { error: "A reason (min 3 chars) is required to impersonate." },
      { status: 400 },
    );

  const owner = await getWorkspaceOwner(body.workspaceId);
  if (!owner)
    return NextResponse.json(
      { error: "no owner to impersonate" },
      { status: 404 },
    );

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(
    owner.userId,
  );
  const email = userRes?.user?.email;
  if (userErr || !email)
    return NextResponse.json(
      { error: "could not resolve target user" },
      { status: 500 },
    );

  const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink(
    { type: "magiclink", email },
  );
  const tokenHash = linkRes?.properties?.hashed_token;
  if (linkErr || !tokenHash)
    return NextResponse.json(
      { error: "could not start impersonation" },
      { status: 500 },
    );

  // Consume the OTP on the request's cookie session → become the target user.
  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyErr)
    return NextResponse.json({ error: verifyErr.message }, { status: 500 });

  const jar = await cookies();
  jar.set("jj_impersonating", email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  await logPlatformAction(actor, "impersonate.start", {
    targetWorkspaceId: body.workspaceId,
    targetUserId: owner.userId,
    detail: { email, reason },
  });

  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
