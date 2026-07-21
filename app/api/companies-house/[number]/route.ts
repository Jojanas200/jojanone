import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  CompaniesHouseError,
  lookupCompany,
  normaliseCompanyNumber,
} from "@/server/services/companies-house";

type Ctx = { params: Promise<{ number: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { number } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const normalised = normaliseCompanyNumber(number);
  if (!normalised)
    return NextResponse.json(
      { error: "invalid company number" },
      { status: 400 },
    );

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  try {
    const lookup = await lookupCompany(ws, normalised, refresh);
    return NextResponse.json({ lookup });
  } catch (err) {
    if (err instanceof CompaniesHouseError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
