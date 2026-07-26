import { Card } from "@/components/ui/card";

// Read-only reference of what each role can do. Kept in sync with the RLS
// write-role policies (apply_tenant_rls) and the module-scoping rules for
// advisers - documentation for humans, not an enforcement surface.
const ROWS: {
  capability: string;
  roles: [string, string, string, string, string];
}[] = [
  {
    capability: "View workspace data",
    roles: ["Yes", "Yes", "Yes", "Scoped", "Yes"],
  },
  {
    capability: "Create and edit records",
    roles: ["Yes", "Yes", "Yes", "Scoped", "No"],
  },
  {
    capability: "Delete records",
    roles: ["Yes", "Yes", "Yes", "Scoped", "No"],
  },
  {
    capability: "Generate reports",
    roles: ["Yes", "Yes", "Yes", "Scoped", "No"],
  },
  {
    capability: "Invite and manage members",
    roles: ["Yes", "Yes", "No", "No", "No"],
  },
  { capability: "Billing and plan", roles: ["Yes", "Yes", "No", "No", "No"] },
  {
    capability: "Workspace settings and branding",
    roles: ["Yes", "Yes", "No", "No", "No"],
  },
  {
    capability: "Export workspace data",
    roles: ["Yes", "Yes", "No", "No", "No"],
  },
  { capability: "Transfer ownership", roles: ["Yes", "No", "No", "No", "No"] },
];

const ROLE_HEADERS = [
  "Owner/Admin",
  "Manager",
  "Team member",
  "Adviser",
  "Read only",
];

export function PermissionsMatrix() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          What each role can do
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Advisers are scoped to the modules you grant them; everything else is
          hidden from them entirely.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-2 font-semibold">Capability</th>
              {ROLE_HEADERS.map((r) => (
                <th key={r} className="px-3 py-2 font-semibold">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.capability} className="border-t border-border">
                <td className="px-5 py-2 text-foreground">{row.capability}</td>
                {row.roles.map((v, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2 ${
                      v === "Yes"
                        ? "text-foreground"
                        : v === "Scoped"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
