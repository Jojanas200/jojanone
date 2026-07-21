import { getClaims } from "@/server/auth/session";
import { exportCsv } from "@/server/services/reports";

type Ctx = { params: Promise<{ dataset: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { dataset } = await params;
  const claims = await getClaims();
  if (!claims) return new Response("unauthorized", { status: 401 });

  const result = await exportCsv(claims, dataset);
  if (!result) return new Response("unknown dataset", { status: 404 });

  return new Response(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
