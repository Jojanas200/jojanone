import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getBusinessProfile } from "@/server/services/settings";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { listEntities } from "@/server/services/business-entities";
import { listContracts } from "@/server/services/contracts";
import { BusinessEntitiesBoard } from "./BusinessEntitiesBoard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fmtDate = (d: string | Date | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export default async function BusinessMapPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "business-map");
  const ws = await getActiveWorkspaceId(claims);
  const [profile, entities, contractRows] = await Promise.all([
    ws ? getBusinessProfile(claims, ws) : Promise.resolve(null),
    listEntities(claims),
    listContracts(claims),
  ]);
  const linkedContracts = contractRows.map((c) => ({
    id: c.id,
    title: c.title,
    entityId: c.entityId,
    status: c.status,
  }));

  const businessName = profile?.businessName?.trim() || "Your business";
  const subline = [
    profile?.businessType,
    profile?.industry,
    profile ? `Profile complete ${profile.profileCompletion}%` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const particulars = [
    { label: "Company number", value: profile?.companyNumber || "-" },
    { label: "Industry", value: profile?.industry || "-" },
    { label: "Incorporated", value: fmtDate(profile?.incorporationDate) },
    { label: "Financial year end", value: profile?.financialYearEnd || "-" },
    { label: "Registered address", value: profile?.registeredAddress || "-" },
    { label: "Trading address", value: profile?.tradingAddress || "-" },
    { label: "Revenue band", value: profile?.annualRevenueBand || "-" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Business Map
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{businessName}</span>
            {subline ? ` · ${subline}` : ""}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Edit business profile</Link>
        </Button>
      </div>

      {/* Business particulars */}
      <Card className="mb-8 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {particulars.map((p) => (
            <div key={p.label} className="min-w-0">
              <p className="text-xs text-muted-foreground">{p.label}</p>
              <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                {p.value}
              </p>
            </div>
          ))}
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile?.vatRegistered && <Badge variant="outline">VAT</Badge>}
              {profile?.employerRegistered && (
                <Badge variant="outline">Employer</Badge>
              )}
              {profile?.processesPersonalData && (
                <Badge variant="secondary">Data</Badge>
              )}
              {profile?.tradesInternationally && (
                <Badge variant="secondary">Intl</Badge>
              )}
              {!profile?.vatRegistered &&
                !profile?.employerRegistered &&
                !profile?.processesPersonalData &&
                !profile?.tradesInternationally && (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
            </div>
          </div>
        </div>
      </Card>

      <BusinessEntitiesBoard
        entities={entities}
        businessName={businessName}
        canWrite={access.canWrite}
        contracts={linkedContracts}
      />
    </div>
  );
}
