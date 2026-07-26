import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { listScenarioRuns } from "@/server/services/scenarios";
import { SimulatorView } from "./SimulatorView";
import { ScenarioPlanner } from "./ScenarioPlanner";

export default async function SimulatorPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "simulator");
  const [s, runs] = await Promise.all([
    getSnapshot(claims),
    listScenarioRuns(claims),
  ]);
  const areas = s.areas.map((a) => ({
    key: a.key,
    label: a.label,
    score: a.score,
    weight: a.weight,
  }));
  const scenarioRuns = runs.map((r) => ({
    id: r.id,
    scenarioType: r.scenarioType,
    scenarioName: r.scenarioName,
    result: r.result as { readiness?: number; outstanding?: string[] },
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Simulator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test decisions before you make them.
        </p>
      </div>
      <SimulatorView areas={areas} baseScore={s.score} />

      <div className="mt-10 border-t border-border pt-8">
        <ScenarioPlanner runs={scenarioRuns} canWrite={access.canWrite} />
      </div>
    </div>
  );
}
