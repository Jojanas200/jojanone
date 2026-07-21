import Link from "next/link";
import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getBusinessMap } from "@/server/services/business-map";
import { Card } from "@/components/ui/card";

export default async function BusinessMapPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "business-map");
  const map = await getBusinessMap(claims);

  const headline: { label: string; value: number }[] = [
    { label: "Employees", value: map.headline.employees },
    { label: "Contractors", value: map.headline.contractors },
    { label: "Customers", value: map.headline.customers },
    { label: "Suppliers", value: map.headline.suppliers },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Business Map
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See your business structure clearly.
        </p>
      </div>

      {/* Centre: the business */}
      <Card className="mb-6 p-6 text-center">
        <p className="text-lg font-semibold text-foreground">
          {map.business.name}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[map.business.type, map.business.industry]
            .filter(Boolean)
            .join(" · ") || "Complete your profile to enrich this view"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {headline.map((h) => (
            <div key={h.label} className="rounded-lg border border-border p-3">
              <p className="text-xl font-semibold text-foreground">{h.value}</p>
              <p className="text-xs text-muted-foreground">{h.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Relationship groups */}
      {map.groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No relationships mapped yet. Add contracts and people, and
          they&apos;ll appear here grouped by type.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {map.groups.map((g) => (
            <Card key={g.key} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Link
                  href={g.href}
                  className="font-medium text-foreground hover:underline"
                >
                  {g.label}
                </Link>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {g.count}
                </span>
              </div>
              {g.members.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {g.members.map((m, i) => (
                    <li key={i} className="truncate">
                      {m}
                    </li>
                  ))}
                  {g.count > g.members.length && (
                    <li className="text-xs italic">
                      +{g.count - g.members.length} more
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {g.count} record{g.count === 1 ? "" : "s"} (no names captured)
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
