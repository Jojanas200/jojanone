import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import {
  getActiveWorkspaceId,
  getWorkspaceRole,
} from "@/server/services/workspaces";
import {
  removeMember,
  updateMemberRole,
  updateMemberScope,
} from "@/server/services/members";
import {
  updateMemberSchema,
  updateMemberScopeSchema,
} from "@/shared/schemas/team";
import { enforceRateLimit } from "@/server/security/rate-limit";

const memberRateLimit = (req: Request) =>
  enforceRateLimit(req, { bucket: "team-members", limit: 40, windowSec: 60 });

async function ownerContext() {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" as const, status: 401 };
  const claims = { sub: user.sub };
  const ws = await getActiveWorkspaceId(claims);
  if (!ws) return { error: "no active workspace" as const, status: 400 };
  const role = await getWorkspaceRole(claims, ws);
  if (role !== "owner_admin")
    return {
      error: "Only workspace owners can manage members." as const,
      status: 403,
    };
  return { claims, ws };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await memberRateLimit(req);
  if (limited) return limited;
  const ctx = await ownerContext();
  if ("error" in ctx)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;

  const body = await req.json().catch(() => null);

  // One PATCH handles two edits: a role change or an adviser re-scope.
  if (body && "scopedModules" in body) {
    const parsed = updateMemberScopeSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    const result = await updateMemberScope(
      ctx.claims,
      ctx.ws,
      id,
      parsed.data.scopedModules,
    );
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const result = await updateMemberRole(
    ctx.claims,
    ctx.ws,
    id,
    parsed.data.role,
  );
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await memberRateLimit(req);
  if (limited) return limited;
  const ctx = await ownerContext();
  if ("error" in ctx)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;

  const result = await removeMember(ctx.claims, ctx.ws, id);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
