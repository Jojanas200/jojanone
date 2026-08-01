import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { listScenarioRuns } from "@/server/services/scenarios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      {s.score === null ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Business Confidence assessment pending
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The simulator projects changes against your current score, so it
            needs a baseline first. Onboarding is {s.onboarding.percent}%
            complete.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/onboarding">
              {s.onboarding.started
                ? "Continue onboarding"
                : "Start onboarding"}
            </Link>
          </Button>
        </Card>
      ) : (
        <SimulatorView areas={areas} baseScore={s.score} />
      )}

      <div className="mt-10 border-t border-border pt-8">
        <ScenarioPlanner runs={scenarioRuns} canWrite={access.canWrite} />
      </div>
    </div>
  );
}
