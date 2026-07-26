import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listContracts } from "@/server/services/contracts";
import { listEntities } from "@/server/services/business-entities";
import { NewContract } from "./NewContract";
import { ContractsBoard } from "./ContractsBoard";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";

export default async function ContractsPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "contracts");
  const [rows, entityRows] = await Promise.all([
    listContracts(claims),
    listEntities(claims),
  ]);
  const entities = entityRows.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Contracts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contracts, understood at a glance.
          </p>
        </div>
        <WriteGate>
          <NewContract entities={entities} />
        </WriteGate>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="contracts" title="Contracts" />
      </WriteGate>

      <ContractsBoard
        contracts={rows}
        canWrite={access.canWrite}
        entities={entities}
      />
    </div>
  );
}
