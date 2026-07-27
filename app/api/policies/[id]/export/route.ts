import { getClaims } from "@/server/auth/session";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { getPolicy } from "@/server/services/policies";
import { getBusinessProfile } from "@/server/services/settings";
import {
  renderPolicyDocx,
  renderPolicyPdf,
} from "@/server/services/policy-export";

// Downloads a policy as PDF or DOCX. Drafts come watermarked "DRAFT - REVIEW
// BEFORE USE" with Jova's recommendations as a labelled appendix; adopted
// policies download clean with the document-control block only. RLS-scoped.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims) return new Response("Unauthorized", { status: 401 });
  const policy = await getPolicy(claims, id);
  if (!policy) return new Response("Not found", { status: 404 });

  const ws = await getActiveWorkspaceId(claims);
  const profile = ws ? await getBusinessProfile(claims, ws) : null;
  const businessName = profile?.businessName ?? null;

  const format = new URL(req.url).searchParams.get("format") ?? "pdf";
  const draft = policy.status !== "active";
  const base = `${policy.policyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)}-v${policy.version}${draft ? "-DRAFT" : ""}`;

  const exportPolicy = {
    policyName: policy.policyName,
    policyCategory: policy.policyCategory,
    version: policy.version,
    owner: policy.owner,
    status: policy.status,
    approvalDate: policy.approvalDate,
    reviewDate: policy.reviewDate,
    adoptedAt: policy.adoptedAt,
    content: policy.content,
    jovaRecommendations: policy.jovaRecommendations ?? [],
  };

  if (format === "docx") {
    const buf = await renderPolicyDocx(exportPolicy, businessName);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${base}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await renderPolicyPdf(exportPolicy, businessName);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
