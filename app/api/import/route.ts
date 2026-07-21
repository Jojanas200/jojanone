import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import {
  analyseCsv,
  commitImport,
  IMPORT_KEYS,
} from "@/server/services/import";

export async function POST(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    dataset?: string;
    csv?: string;
    commit?: boolean;
  } | null;

  if (!body?.dataset || !IMPORT_KEYS.includes(body.dataset))
    return NextResponse.json({ error: "unknown dataset" }, { status: 400 });
  if (typeof body.csv !== "string" || body.csv.trim() === "")
    return NextResponse.json({ error: "empty file" }, { status: 400 });

  if (!body.commit) {
    const preview = analyseCsv(body.dataset, body.csv);
    return NextResponse.json({ preview });
  }

  const ws = await getActiveWorkspaceId(claims);
  if (!ws)
    return NextResponse.json({ error: "no active workspace" }, { status: 400 });

  const result = await commitImport(claims, ws, body.dataset, body.csv);
  return NextResponse.json({ result });
}
