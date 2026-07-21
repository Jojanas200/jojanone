import { isNull, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { businessProfiles, contracts, employees } from "../db/schema";

// Business Map - a read-only structural view of the business: the entity at the
// centre, with its people, customers, suppliers and key relationships derived
// from data already captured across HR and Contracts. One withUser()
// transaction, RLS-scoped to the caller's workspace.

export interface MapGroup {
  key: string;
  label: string;
  count: number;
  href: string;
  members: string[]; // sample of names/counterparties (capped)
}

export interface BusinessMap {
  business: {
    name: string;
    type: string | null;
    industry: string | null;
    profileCompletion: number;
  };
  headline: {
    employees: number;
    contractors: number;
    customers: number;
    suppliers: number;
  };
  groups: MapGroup[];
}

const SAMPLE = 6;

// How each contract type maps into a relationship group.
const CONTRACT_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: "customers", label: "Customers", types: ["customer"] },
  {
    key: "suppliers",
    label: "Suppliers",
    types: ["supplier", "software", "office", "insurance"],
  },
  {
    key: "workforce",
    label: "Workforce contracts",
    types: ["employment", "contractor"],
  },
  { key: "legal", label: "Legal & data", types: ["dpa", "nda", "other"] },
];

export function getBusinessMap(claims: UserClaims): Promise<BusinessMap> {
  return withUser(claims, async (tx) => {
    const [profileRows, con, emp] = await Promise.all([
      tx
        .select({
          name: businessProfiles.businessName,
          type: businessProfiles.businessType,
          industry: businessProfiles.industry,
          completion: businessProfiles.profileCompletion,
          employees: businessProfiles.employeeCount,
          contractors: businessProfiles.contractorCount,
          customers: businessProfiles.customerCount,
          suppliers: businessProfiles.supplierCount,
        })
        .from(businessProfiles)
        .limit(1),
      tx
        .select({
          type: contracts.contractType,
          counterparty: contracts.counterparty,
        })
        .from(contracts)
        .where(isNull(contracts.deletedAt)),
      tx
        .select({
          name: employees.fullName,
          type: employees.employmentType,
          department: employees.department,
        })
        .from(employees)
        .where(
          sql`${employees.deletedAt} is null and ${employees.employmentStatus} <> 'archived'`,
        ),
    ]);

    const p = profileRows[0];

    const groups: MapGroup[] = CONTRACT_GROUPS.map((g) => {
      const matched = con.filter((c) => g.types.includes(c.type));
      const names = Array.from(
        new Set(
          matched
            .map((c) => c.counterparty)
            .filter((n): n is string => !!n && n.trim() !== ""),
        ),
      );
      return {
        key: g.key,
        label: g.label,
        count: matched.length,
        href: "/contracts",
        members: names.slice(0, SAMPLE),
      };
    }).filter((g) => g.count > 0);

    // People group derived from HR (live headcount by name).
    if (emp.length > 0) {
      groups.unshift({
        key: "people",
        label: "People",
        count: emp.length,
        href: "/hr",
        members: emp.map((e) => e.name).slice(0, SAMPLE),
      });
    }

    return {
      business: {
        name: p?.name?.trim() || "Your business",
        type: p?.type ?? null,
        industry: p?.industry ?? null,
        profileCompletion: p?.completion ?? 0,
      },
      headline: {
        employees: p?.employees ?? 0,
        contractors: p?.contractors ?? 0,
        customers: p?.customers ?? 0,
        suppliers: p?.suppliers ?? 0,
      },
      groups,
    };
  });
}
