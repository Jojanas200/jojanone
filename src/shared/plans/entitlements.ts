import { MODULES } from "@/config/modules.config";

// What a plan can and cannot withhold.
//
// The Business Confidence Score is derived from compliance, risk, people,
// contracts, data protection, governance and documents/evidence. A plan that
// withheld any of those would sell a product whose headline number cannot be
// calculated, so those modules - plus the shell a workspace needs to function -
// are granted on every plan and are not offered in the designer.

export const CORE_MODULES = [
  "dashboard",
  "settings",
  "billing",
  "compliance",
  "risk",
  "hr",
  "contracts",
  "gdpr",
  "governance",
  "policies",
  "evidence",
] as const;

const CORE = new Set<string>(CORE_MODULES);

export const isCoreModule = (key: string) => CORE.has(key);

/** Modules an admin can allocate between packages. */
export const OPTIONAL_MODULES = MODULES.filter((m) => !CORE.has(m.key)).map(
  (m) => ({ key: m.key, title: m.title }),
);

const OPTIONAL_KEYS = new Set(OPTIONAL_MODULES.map((m) => m.key));

/** Drop unknown or core keys so a stored feature list is always meaningful. */
export function normaliseFeatures(features: readonly string[]): string[] {
  return [...new Set(features)].filter((f) => OPTIONAL_KEYS.has(f)).sort();
}

/**
 * Whether a workspace on `features` may open `moduleKey`. A null feature list
 * means "unrestricted": workspaces with no subscription (trials, imported and
 * legacy tenants) keep full access rather than being silently locked out.
 */
export function planAllowsModule(
  features: readonly string[] | null,
  moduleKey: string,
): boolean {
  if (CORE.has(moduleKey)) return true;
  if (features === null) return true;
  return features.includes(moduleKey);
}
