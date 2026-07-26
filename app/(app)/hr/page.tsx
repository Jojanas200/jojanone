import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listEmployees } from "@/server/services/hr";
import { listHrActions } from "@/server/services/hr-actions";
import { NewEmployee } from "./NewEmployee";
import { HrBoard } from "./HrBoard";
import { HrActionsBoard } from "./HrActionsBoard";
import { WriteGate } from "../WriteGate";
import { ModuleSetup } from "../../onboarding/ModuleSetup";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function HrPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "hr");
  const [rows, actions] = await Promise.all([
    listEmployees(claims),
    listHrActions(claims),
  ]);
  const employeeOptions = rows.map((e) => ({ id: e.id, fullName: e.fullName }));
  const openActions = actions.filter((a) => a.status !== "completed").length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            HR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People risk, made visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/policies">Draft HR policy or handbook</Link>
          </Button>
          <WriteGate>
            <NewEmployee />
          </WriteGate>
        </div>
      </div>

      <WriteGate>
        <ModuleSetup moduleKey="hr" title="HR" />
      </WriteGate>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People ({rows.length})</TabsTrigger>
          <TabsTrigger value="actions">
            Actions{openActions > 0 ? ` (${openActions})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-6">
          <HrBoard
            employees={rows}
            actions={actions}
            canWrite={access.canWrite}
          />
        </TabsContent>
        <TabsContent value="actions" className="mt-6">
          <HrActionsBoard
            actions={actions}
            employees={employeeOptions}
            canWrite={access.canWrite}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
