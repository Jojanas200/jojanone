import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listObligations } from "@/server/services/compliance";
import { getBusinessProfile } from "@/server/services/settings";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { NewObligation } from "./NewObligation";
import { ComplianceBoard } from "./ComplianceBoard";
import { ApplicabilityAssessment } from "./ApplicabilityAssessment";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";

export default async function CompliancePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "compliance");
  const ws = await getActiveWorkspaceId(claims);
  const [rows, profile] = await Promise.all([
    listObligations(claims),
    ws ? getBusinessProfile(claims, ws) : Promise.resolve(null),
  ]);

  const facts = {
    isLimited: profile?.businessType
      ? /limited|ltd/i.test(profile.businessType)
      : true,
    vatRegistered: profile?.vatRegistered ?? false,
    employerRegistered: profile?.employerRegistered ?? false,
    employeeCount: profile?.employeeCount ?? 0,
    processesPersonalData: profile?.processesPersonalData ?? false,
    tradesInternationally: profile?.tradesInternationally ?? false,
    supplierCount: profile?.supplierCount ?? 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Compliance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every obligation, tracked automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ApplicabilityAssessment facts={facts} />
          <WriteGate>
            <NewObligation />
          </WriteGate>
        </div>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="compliance" title="Compliance" />
      </WriteGate>

      <ComplianceBoard obligations={rows} canWrite={access.canWrite} />
    </div>
  );
}
