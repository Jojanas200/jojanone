import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getPolicy, listPolicyVersions } from "@/server/services/policies";
import { runPolicyCheck } from "@/shared/policies/check";
import { POLICY_TEMPLATES } from "@/shared/policies/templates";
import { JovaPolicyCheck } from "./JovaPolicyCheck";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listAcknowledgements,
  listUnassignedEmployees,
} from "@/server/services/policy-acknowledgements";
import { AssignAck } from "./AssignAck";
import { AckRowActions } from "./AckRowActions";
import { PolicyDocument } from "./PolicyDocument";
import { PolicyVersionHistory } from "./PolicyVersionHistory";
import { WriteGate } from "../../WriteGate";
import {
  PolicyHeaderActions,
  PolicyProperties,
  ProfessionalReview,
  type PolicyLite,
} from "./PolicyTools";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Ctx = { params: Promise<{ id: string }> };

const fmtDate = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const policyStatusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = { draft: "outline", active: "success", archived: "outline" };

const ackStatusVariant: Record<
  string,
  "outline" | "secondary" | "default" | "destructive"
> = { pending: "outline", acknowledged: "default", waived: "secondary" };

const rollupLabel: Record<string, string> = {
  not_started: "Not started",
  partial: "Partial",
  complete: "Complete",
};

export default async function PolicyDetailPage({ params }: Ctx) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "policies");

  const policy = await getPolicy(claims, id);
  if (!policy) notFound();

  const [roster, unassigned, versions] = await Promise.all([
    listAcknowledgements(claims, id),
    listUnassignedEmployees(claims, id),
    listPolicyVersions(claims, id),
  ]);
  const versionsForClient = versions.map((v) => ({
    id: v.id,
    version: v.version,
    status: v.status,
    policyName: v.policyName,
    content: v.content,
    createdAt: v.createdAt.toISOString(),
  }));

  const policyLite: PolicyLite = {
    id: policy.id,
    policyName: policy.policyName,
    policyCategory: policy.policyCategory,
    version: policy.version,
    owner: policy.owner,
    status: policy.status,
    approvalDate: policy.approvalDate,
    reviewDate: policy.reviewDate,
    acknowledgementRequired: policy.acknowledgementRequired,
    notes: policy.notes,
    content: policy.content,
    professionalReviewStatus: policy.professionalReviewStatus,
    professionalReviewNote: policy.professionalReviewNote,
  };

  const check = runPolicyCheck(policy.content ?? "", {
    owner: policy.owner,
    reviewDate: policy.reviewDate,
    version: policy.version,
    templateKey:
      POLICY_TEMPLATES.find(
        (t) => t.title.toLowerCase() === policy.policyName.trim().toLowerCase(),
      )?.key ?? null,
    category: policy.policyCategory,
  });

  const acknowledged = roster.filter((r) => r.status === "acknowledged").length;
  const waived = roster.filter((r) => r.status === "waived").length;
  const pending = roster.filter((r) => r.status === "pending").length;

  const stats = [
    { label: "Assigned", value: roster.length },
    { label: "Acknowledged", value: acknowledged },
    { label: "Pending", value: pending },
    { label: "Waived", value: waived },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/policies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Policies
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {policy.policyName}
            </h1>
            <Badge variant={policyStatusVariant[policy.status] ?? "outline"}>
              {policy.status}
            </Badge>
            {policy.status === "draft" && check.readyForAdoption && (
              <Badge variant="success">Ready for adoption</Badge>
            )}
            {policy.status === "draft" && !check.readyForAdoption && (
              <Badge variant="destructive">{check.criticals} to resolve</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {policy.policyCategory ?? "Uncategorised"} · v{policy.version}
            {policy.owner ? ` · Owner: ${policy.owner}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/policies/${policy.id}/export?format=pdf`}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              PDF{policy.status === "active" ? "" : " (draft)"}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/policies/${policy.id}/export?format=docx`}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              DOCX{policy.status === "active" ? "" : " (draft)"}
            </a>
          </Button>
          <WriteGate>
            <PolicyHeaderActions policy={policyLite} />
          </WriteGate>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {fmtDate(policy.approvalDate)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Next review</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {fmtDate(policy.reviewDate)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sign-off required</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {policy.acknowledgementRequired ? "Yes" : "No"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sign-off status</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {rollupLabel[policy.acknowledgementStatus] ??
              policy.acknowledgementStatus}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="document">
        <TabsList>
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="check">
            Jova Check
            {check.criticals > 0
              ? ` (${check.criticals})`
              : check.warnings > 0
                ? ` (${check.warnings})`
                : ""}
          </TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="professional">Professional review</TabsTrigger>
          <TabsTrigger value="signoff">
            Sign-off{roster.length ? ` (${roster.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="versions">
            Versions{versions.length ? ` (${versions.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="document" className="mt-6">
          <PolicyDocument
            policyId={policy.id}
            content={policy.content}
            canWrite={access.canWrite}
          />
        </TabsContent>

        <TabsContent value="check" className="mt-6">
          <JovaPolicyCheck
            policyId={policy.id}
            status={policy.status}
            items={check.items}
            criticals={check.criticals}
            warnings={check.warnings}
            ready={check.readyForAdoption}
            recommendations={policy.jovaRecommendations ?? []}
            canWrite={access.canWrite}
          />
        </TabsContent>

        <TabsContent value="properties" className="mt-6">
          <PolicyProperties policy={policyLite} canWrite={access.canWrite} />
        </TabsContent>

        <TabsContent value="professional" className="mt-6">
          <ProfessionalReview policy={policyLite} canWrite={access.canWrite} />
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <PolicyVersionHistory versions={versionsForClient} />
        </TabsContent>

        <TabsContent value="signoff" className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Staff sign-off
              </h2>
              <p className="text-sm text-muted-foreground">
                Record which team members have acknowledged this policy.
              </p>
            </div>
            <WriteGate>
              <AssignAck policyId={policy.id} employees={unassigned} />
            </WriteGate>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-2xl font-semibold text-foreground">
                  {s.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.label}
                </p>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No one assigned yet. Use “Assign staff” to request
                        sign-off.
                      </TableCell>
                    </TableRow>
                  ) : (
                    roster.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">
                          {r.fullName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.jobTitle ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={ackStatusVariant[r.status] ?? "outline"}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmtDate(r.acknowledgedAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.policyVersion ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <WriteGate>
                            <AckRowActions
                              policyId={policy.id}
                              ackId={r.id}
                              status={r.status}
                            />
                          </WriteGate>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Sign-off is recorded by a workspace member on the employee’s behalf
            and stored with the policy version in force at the time.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
