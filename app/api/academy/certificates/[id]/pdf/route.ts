import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { getCertificate } from "@/server/services/academy";
import { getBusinessProfile } from "@/server/services/settings";
import { renderCertificatePdf } from "@/server/services/academy-certificate";

// Downloads a branded Certificate of Completion as a real PDF. The row is
// fetched through RLS, so only the owning workspace can download it.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims) return new Response("Unauthorized", { status: 401 });
  const cert = await getCertificate(claims, id);
  if (!cert) return new Response("Not found", { status: 404 });

  const ws = await getActiveWorkspaceId(claims);
  const profile = ws ? await getBusinessProfile(claims, ws) : null;

  // The wordmark logo, fetched from our own static assets; the certificate
  // falls back to a typeset wordmark if it cannot be loaded.
  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(new URL("/assets/logo-header.png", req.url));
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    logo = null;
  }

  const pdf = await renderCertificatePdf(
    {
      reference: cert.reference,
      learnerName: cert.learnerName ?? profile?.primaryContactName ?? null,
      courseTitle: cert.courseTitle ?? cert.courseId,
      quizScore: cert.quizScore,
      durationMinutes: cert.durationMinutes,
      completedAt: cert.completedAt,
      businessName: profile?.businessName ?? null,
    },
    logo,
  );

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="jojan-one-certificate-${cert.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
