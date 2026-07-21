import { NextResponse } from "next/server";
import {
  logPlatformAction,
  requirePlatformAdmin,
} from "@/server/services/platform-admin";
import { getTenantExport } from "@/server/services/platform-support";

// Metadata-only tenant export (account, subscription, members, record counts -
// never the business records). Operators only; audited. Returns a JSON download.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const { id } = await params;
  const data = await getTenantExport(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  await logPlatformAction(actor, "tenant.export", { targetWorkspaceId: id });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="tenant-${id}.json"`,
    },
  });
}
