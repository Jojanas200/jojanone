import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { createContract, listContracts } from "@/server/services/contracts";
import { createContractSchema } from "@/shared/schemas/contract";

export async function GET() {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listContracts(claims);
  return NextResponse.json({ contracts: rows });
}

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid contract", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await createContract(claims, ws, parsed.data);
  return NextResponse.json({ contract: created }, { status: 201 });
}
