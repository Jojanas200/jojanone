import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listPolicies } from "@/server/services/policies";
import { getBusinessProfile } from "@/server/services/settings";
import { PoliciesView, type PolicyRow } from "./PoliciesView";
import { Card } from "@/components/ui/card";

const isOverdue = (d: string | null) =>
  !!d && new Date(d).getTime() < Date.now();

export default async function PoliciesPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { workspaceId, access } = await requireModuleAccess(claims, "policies");

  const [rows, profile] = await Promise.all([
    listPolicies(claims),
    getBusinessProfile(claims, workspaceId),
  ]);

  const active = rows.filter((r) => r.status === "active").length;
  const dueReview = rows.filter(
    (r) => r.status !== "archived" && isOverdue(r.reviewDate),
  ).length;
  const ackOutstanding = rows.filter(
    (r) => r.acknowledgementRequired && r.acknowledgementStatus !== "complete",
  ).length;

  const stats = [
    { label: "Policies", value: rows.length },
    { label: "Active", value: active },
    { label: "Due for review", value: dueReview },
    { label: "Sign-off outstanding", value: ackOutstanding },
  ];

  const policyRows: PolicyRow[] = rows.map((p) => ({
    id: p.id,
    policyName: p.policyName,
    policyCategory: p.policyCategory,
    version: p.version,
    owner: p.owner,
    status: p.status,
    acknowledgementRequired: p.acknowledgementRequired,
    acknowledgementStatus: p.acknowledgementStatus,
    reviewDate: p.reviewDate,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Policies
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The policies your business relies on - versioned, owned, reviewed on a
          schedule, with staff sign-off tracked.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <PoliciesView
        policies={policyRows}
        canWrite={access.canWrite}
        profile={{
          businessName: profile?.businessName ?? null,
          industry: profile?.industry ?? null,
          employeeCount: profile?.employeeCount ?? null,
          primaryContactName: profile?.primaryContactName ?? null,
        }}
      />

      <p className="mt-4 text-[11px] text-muted-foreground">
        Guidance to help you maintain your policies - not legal advice. Have
        material policies reviewed by a qualified professional.
      </p>
    </div>
  );
}
