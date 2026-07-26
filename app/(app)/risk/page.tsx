import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listRisks } from "@/server/services/risk";
import { NewRisk } from "./NewRisk";
import { RiskBoard } from "./RiskBoard";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";

export default async function RiskPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "risk");
  const rows = await listRisks(claims);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Risk
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A complete picture of business risk.
          </p>
        </div>
        <WriteGate>
          <NewRisk />
        </WriteGate>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="risk" title="Risk" />
      </WriteGate>

      <RiskBoard risks={rows} canWrite={access.canWrite} />
    </div>
  );
}
