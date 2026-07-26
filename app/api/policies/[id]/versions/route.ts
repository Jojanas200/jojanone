import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { listPolicyVersions } from "@/server/services/policies";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const versions = await listPolicyVersions(claims, id);
  return NextResponse.json({ versions });
}
