import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { draftPolicy } from "@/server/services/policies";
import { draftPolicySchema } from "@/shared/schemas/policies";

// Ask Jova to draft a full policy document grounded in the business profile.
// Always creates a DRAFT the user reviews before adopting.
export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = draftPolicySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );

  const created = await draftPolicy(claims, ws, parsed.data);
  return NextResponse.json({ policy: created }, { status: 201 });
}
