import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getSnapshot } from "@/server/services/dashboard";
import { SimulatorView } from "./SimulatorView";

export default async function SimulatorPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "simulator");
  const s = await getSnapshot(claims);
  const areas = s.areas.map((a) => ({
    key: a.key,
    label: a.label,
    score: a.score,
    weight: a.weight,
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Simulator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test decisions before you make them.
        </p>
      </div>
      <SimulatorView areas={areas} baseScore={s.score} />
    </div>
  );
}
