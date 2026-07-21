import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { ImportWizard } from "./ImportWizard";

export default async function ImportPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "import");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bulk import
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring existing records into Jojan from a CSV. Every row is validated
          before anything is saved.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
