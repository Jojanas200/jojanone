import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { getBusinessProfile } from "@/server/services/settings";
import { CompaniesHouseLookup } from "./CompaniesHouseLookup";

export default async function CompaniesHousePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "companies-house");
  const ws = await getActiveWorkspaceId(claims);
  const profile = ws ? await getBusinessProfile(claims, ws) : null;
  const initial = profile?.companyNumber ?? "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Companies House
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up official, read-only company data. Every value is labelled with
          its source and retrieval time.
        </p>
      </div>
      <CompaniesHouseLookup initial={initial} />
    </div>
  );
}
