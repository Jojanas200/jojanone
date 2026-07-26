import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listGovernanceRecords } from "@/server/services/governance";
import { listPolicies } from "@/server/services/policies";
import { NewRecord } from "./NewRecord";
import { GovernanceBoard } from "./GovernanceBoard";
import { GovernanceCalendar } from "./GovernanceCalendar";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function GovernancePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "governance");
  const [rows, policies] = await Promise.all([
    listGovernanceRecords(claims),
    listPolicies(claims),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Governance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Board-level discipline, without the overhead.
          </p>
        </div>
        <WriteGate>
          <NewRecord />
        </WriteGate>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="governance" title="Governance" />
      </WriteGate>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">
            Records{rows.length ? ` (${rows.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6">
          <GovernanceBoard records={rows} canWrite={access.canWrite} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <GovernanceCalendar records={rows} policies={policies} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
