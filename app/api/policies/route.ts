import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { createPolicy, listPolicies } from "@/server/services/policies";
import { createPolicySchema } from "@/shared/schemas/policies";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listPolicies(claims);
  return NextResponse.json({ policies: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createPolicySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid policy", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await createPolicy(claims, ws, parsed.data);
  return NextResponse.json({ policy: created }, { status: 201 });
}
