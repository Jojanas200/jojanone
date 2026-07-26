import { eq } from "drizzle-orm";
import { withUser } from "../db";
import {
  complianceObligations,
  policies,
  processingActivities,
  risks,
} from "../db/schema";
import { recordActivity } from "./activity";
import { getField } from "../../shared/onboarding/logic";
import type { OnboardingAnswers } from "../../shared/onboarding/types";

/**
 * On first-time onboarding completion, seed lightweight STARTER records across
 * the modules from the answers, so each module opens pre-populated rather than
 * empty. Runs inside completeOnboarding's transaction (atomic) and only on the
 * first completion, so it never duplicates. These are starting points a user
 * refines - not a claim that the work is done.
 */

type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

const yes = (a: OnboardingAnswers, id: string) => a[id] === "yes";
const no = (a: OnboardingAnswers, id: string) => a[id] === "no";
const unsure = (a: OnboardingAnswers, id: string) => a[id] === "unsure";
const isTrue = (a: OnboardingAnswers, id: string) => a[id] === true;
const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

// Map a multiselect field's stored values back to their human labels.
const labelsFor = (fieldId: string, value: unknown): string | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const opts = getField(fieldId)?.options ?? [];
  return value
    .map((v) => opts.find((o) => o.value === v)?.label ?? String(v))
    .join(", ");
};

export async function seedModulesFromOnboarding(
  tx: Tx,
  workspaceId: string,
  actorSub: string,
  a: OnboardingAnswers,
): Promise<number> {
  let total = 0;
  total += await seedCompliance(tx, workspaceId, actorSub, a);
  total += await seedRisks(tx, workspaceId, actorSub, a);
  total += await seedPolicies(tx, workspaceId, actorSub, a);
  total += await seedGdpr(tx, workspaceId, actorSub, a);
  return total;
}

// --- Compliance obligations --------------------------------------------------
type ObligationSeed = {
  title: string;
  category: (typeof complianceObligations.$inferInsert)["category"];
  priority: "high" | "medium" | "low";
  reasonApplies: string;
  requiredAction?: string;
  status?: "upcoming" | "action_required";
  professionalSupportRequired?: boolean;
};

async function seedCompliance(
  tx: Tx,
  workspaceId: string,
  actorSub: string,
  a: OnboardingAnswers,
): Promise<number> {
  const structure = a["company.business_structure"];
  const isCompany = structure === "limited_company" || structure === "llp";
  const seeds: ObligationSeed[] = [];

  if (isCompany && !no(a, "compliance.company_filings"))
    seeds.push({
      title: "File confirmation statement and annual accounts",
      category: "companies_house",
      priority: "high",
      reasonApplies: "You are registered as a company or LLP.",
      requiredAction: "Confirm your filing dates with Companies House.",
    });

  if (yes(a, "ops.vat_registered"))
    seeds.push({
      title: "Submit VAT returns",
      category: "vat",
      priority: "high",
      reasonApplies: "You told us you are VAT registered.",
    });

  if (isTrue(a, "ops.employs_staff")) {
    seeds.push({
      title: "Operate PAYE payroll and meet employer duties",
      category: "payroll",
      priority: "high",
      reasonApplies: "You employ staff.",
    });
    seeds.push({
      title: "Meet workplace pension (auto-enrolment) duties",
      category: "pensions",
      priority: "medium",
      reasonApplies: "You employ staff.",
    });
  } else if (yes(a, "compliance.pensions")) {
    seeds.push({
      title: "Meet workplace pension (auto-enrolment) duties",
      category: "pensions",
      priority: "medium",
      reasonApplies: "You told us pension duties may apply.",
    });
  }

  if (yes(a, "ops.processes_personal_data") && !yes(a, "gdpr.ico_fee"))
    seeds.push({
      title: "Register with the ICO / pay the data protection fee",
      category: "data_protection",
      priority: "medium",
      reasonApplies: "You process personal data.",
      requiredAction: "Check whether an ICO fee is due and register.",
    });

  if (yes(a, "compliance.health_safety"))
    seeds.push({
      title: "Complete a health & safety risk assessment",
      category: "health_safety",
      priority: "medium",
      reasonApplies: "You told us health & safety duties apply.",
    });

  if (yes(a, "compliance.insurance"))
    seeds.push({
      title: "Confirm required business insurance is in place",
      category: "insurance_business",
      priority: "medium",
      reasonApplies: "You told us insurance requirements apply.",
    });

  // "Unsure" answers become review obligations - surfaced, never blocking.
  const unsureTopics: Record<string, string> = {
    "compliance.company_filings": "company filing responsibilities",
    "compliance.pensions": "workplace pension duties",
    "compliance.health_safety": "health & safety responsibilities",
    "compliance.insurance": "insurance requirements",
    "compliance.sector_obligations": "sector-specific obligations",
    "ops.vat_registered": "VAT registration",
    "ops.regulated_activities": "regulated activities",
    "ops.processes_personal_data": "data protection duties",
  };
  for (const [id, topic] of Object.entries(unsureTopics))
    if (unsure(a, id))
      seeds.push({
        title: `Review whether ${topic} apply`,
        category: "other",
        priority: "medium",
        status: "action_required",
        reasonApplies: "You were unsure during onboarding.",
        professionalSupportRequired: true,
      });

  if (!seeds.length) return 0;

  await tx.insert(complianceObligations).values(
    seeds.map((s) => ({
      workspaceId,
      title: s.title,
      category: s.category,
      priority: s.priority,
      status: s.status ?? ("upcoming" as const),
      reasonApplies: s.reasonApplies,
      requiredAction: s.requiredAction,
      professionalSupportRequired: s.professionalSupportRequired ?? false,
      sourceType: "onboarding",
      createdBy: actorSub,
      updatedBy: actorSub,
    })),
  );
  await recordActivity(tx, workspaceId, {
    module: "compliance",
    action: "created",
    title: `${seeds.length} starter obligation${seeds.length === 1 ? "" : "s"} from onboarding`,
  });
  return seeds.length;
}

// --- Risk register -----------------------------------------------------------
type RiskSeed = {
  riskTitle: string;
  riskCategory: (typeof risks.$inferInsert)["riskCategory"];
  description: string;
  response: "transfer" | "reduce";
};

async function seedRisks(
  tx: Tx,
  workspaceId: string,
  actorSub: string,
  a: OnboardingAnswers,
): Promise<number> {
  const seeds: RiskSeed[] = [];

  if (isTrue(a, "ops.employs_staff") && no(a, "risk.ins_employers_liability"))
    seeds.push({
      riskTitle: "No employers’ liability insurance in place",
      riskCategory: "people",
      description:
        "Employers’ liability insurance is generally a legal requirement when you employ staff.",
      response: "transfer",
    });
  if (no(a, "risk.ins_professional_indemnity"))
    seeds.push({
      riskTitle: "No professional indemnity insurance",
      riskCategory: "operational",
      description: "You indicated no professional indemnity cover is in place.",
      response: "transfer",
    });
  if (no(a, "risk.ins_public_liability"))
    seeds.push({
      riskTitle: "No public liability insurance",
      riskCategory: "operational",
      description: "You indicated no public liability cover is in place.",
      response: "transfer",
    });
  if (
    no(a, "risk.ins_cyber") &&
    (isTrue(a, "ops.has_website") || yes(a, "ops.processes_personal_data"))
  )
    seeds.push({
      riskTitle: "No cyber insurance",
      riskCategory: "cyber",
      description:
        "You run a website or process personal data but hold no cyber cover.",
      response: "transfer",
    });
  if (no(a, "risk.continuity_plans"))
    seeds.push({
      riskTitle: "No business continuity or incident-response plan",
      riskCategory: "operational",
      description: "No continuity or incident-response plan is in place.",
      response: "reduce",
    });

  if (!seeds.length) return 0;

  const owner = str(a["risk.owner"]);
  await tx.insert(risks).values(
    seeds.map((s) => ({
      workspaceId,
      riskTitle: s.riskTitle,
      riskCategory: s.riskCategory,
      description: s.description,
      response: s.response,
      status: "open" as const,
      riskOwner: owner,
      createdBy: actorSub,
      updatedBy: actorSub,
    })),
  );
  await recordActivity(tx, workspaceId, {
    module: "risk",
    action: "created",
    title: `${seeds.length} starter risk${seeds.length === 1 ? "" : "s"} from onboarding`,
  });
  return seeds.length;
}

// --- Policy stubs ------------------------------------------------------------
async function seedPolicies(
  tx: Tx,
  workspaceId: string,
  actorSub: string,
  a: OnboardingAnswers,
): Promise<number> {
  const wanted: {
    policyName: string;
    policyCategory: string;
    owner?: string;
  }[] = [];

  if (
    yes(a, "ops.processes_personal_data") &&
    !yes(a, "gdpr.has_privacy_notice")
  )
    wanted.push({
      policyName: "Data Protection Policy",
      policyCategory: "Data protection",
      owner: str(a["gdpr.dp_owner"]),
    });
  if (yes(a, "compliance.health_safety"))
    wanted.push({
      policyName: "Health & Safety Policy",
      policyCategory: "Health & safety",
    });
  if (isTrue(a, "ops.employs_staff") && !yes(a, "workforce.has_handbook"))
    wanted.push({
      policyName: "Disciplinary & Grievance Policy",
      policyCategory: "HR & employment",
      owner: str(a["workforce.hr_owner"]),
    });

  if (!wanted.length) return 0;

  // Idempotent guard: skip any policy name the workspace already has.
  const existing = new Set(
    (
      await tx
        .select({ name: policies.policyName })
        .from(policies)
        .where(eq(policies.workspaceId, workspaceId))
    ).map((r) => r.name),
  );
  const toCreate = wanted.filter((w) => !existing.has(w.policyName));
  if (!toCreate.length) return 0;

  await tx.insert(policies).values(
    toCreate.map((w) => ({
      workspaceId,
      policyName: w.policyName,
      policyCategory: w.policyCategory,
      status: "draft" as const,
      version: "1.0",
      owner: w.owner,
      notes: "Suggested from onboarding - review and adopt.",
      createdBy: actorSub,
      updatedBy: actorSub,
    })),
  );
  await recordActivity(tx, workspaceId, {
    module: "policies",
    action: "created",
    title: `${toCreate.length} suggested polic${toCreate.length === 1 ? "y" : "ies"} from onboarding`,
  });
  return toCreate.length;
}

// --- GDPR: a starter Record of Processing Activities (ROPA) entry -------------
async function seedGdpr(
  tx: Tx,
  workspaceId: string,
  actorSub: string,
  a: OnboardingAnswers,
): Promise<number> {
  // Only when they process personal data and don't already keep a ROPA.
  if (!yes(a, "ops.processes_personal_data")) return 0;
  if (yes(a, "gdpr.has_ropa")) return 0;

  await tx.insert(processingActivities).values({
    workspaceId,
    activityName: "General business processing",
    businessPurpose:
      labelsFor("gdpr.purposes", a["gdpr.purposes"]) ?? "To be documented",
    dataSubjects: labelsFor("gdpr.data_subjects", a["gdpr.data_subjects"]),
    personalDataCategories: labelsFor(
      "gdpr.data_categories",
      a["gdpr.data_categories"],
    ),
    specialCategoryData: yes(a, "gdpr.special_category"),
    processors: yes(a, "gdpr.shares_with_processors")
      ? "Shared with processors - to be documented"
      : undefined,
    internationalTransfers: yes(a, "gdpr.transfers_outside_uk"),
    owner: str(a["gdpr.dp_owner"]),
    status: "active",
    createdBy: actorSub,
    updatedBy: actorSub,
  });
  await recordActivity(tx, workspaceId, {
    module: "gdpr",
    action: "created",
    title: "Starter Record of Processing Activities from onboarding",
  });
  return 1;
}
