import { getClaims } from "@/server/auth/session";
import { templateCsv } from "@/server/services/import";

type Ctx = { params: Promise<{ dataset: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { dataset } = await params;
  const claims = await getClaims();
  if (!claims) return new Response("unauthorized", { status: 401 });

  const csv = templateCsv(dataset);
  if (!csv) return new Response("unknown dataset", { status: 404 });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jojan-${dataset}-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
