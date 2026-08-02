import { and, asc, eq, isNull } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { plans } from "../db/schema";
import { logPlatformAction, type PlatformActor } from "./platform-admin";
import { syncPlanToStripe } from "./plan-stripe";
import { normaliseFeatures } from "../../shared/plans/entitlements";

// The package catalogue: what an operator designs, prices and publishes.
// Billing, seat enforcement, module entitlements and the public pricing page
// all read from here, so a package is described in exactly one place.

export interface PlanRow {
  key: string;
  name: string;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  billingInterval: string;
  seatLimit: number | null;
  features: string[];
  trialDays: number;
  isSellable: boolean;
  isHighlighted: boolean;
  published: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  sortOrder: number;
}

const COLUMNS = {
  key: plans.key,
  name: plans.name,
  description: plans.description,
  priceMinor: plans.priceMinor,
  currency: plans.currency,
  billingInterval: plans.billingInterval,
  seatLimit: plans.seatLimit,
  features: plans.features,
  trialDays: plans.trialDays,
  isSellable: plans.isSellable,
  isHighlighted: plans.isHighlighted,
  published: plans.published,
  stripeProductId: plans.stripeProductId,
  stripePriceId: plans.stripePriceId,
  sortOrder: plans.sortOrder,
};

/** Every package, archived ones excluded. Operators only. */
export async function listPlansFull(): Promise<PlanRow[]> {
  return adminDb
    .select(COLUMNS)
    .from(plans)
    .where(isNull(plans.archivedAt))
    .orderBy(asc(plans.sortOrder));
}

/** Published, sellable packages for the public pricing page. No auth needed. */
export async function listPublishedPlans(): Promise<PlanRow[]> {
  return adminDb
    .select(COLUMNS)
    .from(plans)
    .where(
      and(
        isNull(plans.archivedAt),
        eq(plans.published, true),
        eq(plans.isSellable, true),
      ),
    )
    .orderBy(asc(plans.sortOrder));
}

export async function getPlan(key: string): Promise<PlanRow | null> {
  const rows = await adminDb
    .select(COLUMNS)
    .from(plans)
    .where(eq(plans.key, key))
    .limit(1);
  return rows[0] ?? null;
}

export interface PlanPatch {
  name?: string;
  description?: string | null;
  priceMinor?: number | null;
  currency?: string;
  billingInterval?: string;
  seatLimit?: number | null;
  features?: string[];
  trialDays?: number;
  isSellable?: boolean;
  isHighlighted?: boolean;
  published?: boolean;
  sortOrder?: number;
}

export type PlanResult =
  { ok: true; warning?: string | null } | { ok: false; error: string };

const KEY_RE = /^[a-z][a-z0-9_-]{1,38}$/;

function validate(patch: PlanPatch): string | null {
  if (patch.name !== undefined && !patch.name.trim())
    return "Name is required.";
  if (
    patch.priceMinor !== undefined &&
    patch.priceMinor !== null &&
    patch.priceMinor < 0
  )
    return "Price cannot be negative.";
  if (
    patch.seatLimit !== undefined &&
    patch.seatLimit !== null &&
    patch.seatLimit < 1
  )
    return "Seat limit must be at least 1 (or blank for unlimited).";
  if (
    patch.trialDays !== undefined &&
    (patch.trialDays < 0 || patch.trialDays > 365)
  )
    return "Free trial must be between 0 and 365 days.";
  if (
    patch.billingInterval !== undefined &&
    !["month", "year"].includes(patch.billingInterval)
  )
    return "Billing interval must be monthly or yearly.";
  if (patch.currency !== undefined && !/^[A-Z]{3}$/.test(patch.currency))
    return "Currency must be a 3-letter code such as GBP.";
  return null;
}

/** Publishing a package that cannot be bought would be a dead end. */
function publishBlockers(row: PlanRow): string | null {
  if (!row.name.trim()) return "Give the package a name before publishing.";
  if (row.priceMinor === null)
    return "Set a price (or 0 for a free package) before publishing.";
  if (row.priceMinor > 0 && !row.stripePriceId)
    return "This package has no Stripe price yet. Connect Stripe and save the price, then publish.";
  return null;
}

export async function createPlan(
  actor: PlatformActor,
  input: PlanPatch & { key: string },
): Promise<PlanResult> {
  const key = input.key.trim().toLowerCase();
  if (!KEY_RE.test(key))
    return {
      ok: false,
      error:
        "Key must start with a letter and use lower-case letters, numbers, dashes or underscores.",
    };
  if (await getPlan(key))
    return { ok: false, error: `A package with the key "${key}" exists.` };
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const priceMinor = input.priceMinor ?? null;
  const currency = input.currency ?? "GBP";
  const billingInterval = input.billingInterval ?? "month";

  const sync = await syncPlanToStripe({
    key,
    name: input.name?.trim() ?? key,
    description: input.description ?? null,
    priceMinor,
    currency,
    billingInterval,
    stripeProductId: null,
    stripePriceId: null,
  });

  await adminDb.insert(plans).values({
    key,
    name: input.name?.trim() ?? key,
    description: input.description ?? null,
    priceMinor,
    currency,
    billingInterval,
    seatLimit: input.seatLimit ?? null,
    features: normaliseFeatures(input.features ?? []),
    trialDays: input.trialDays ?? 0,
    isSellable: input.isSellable ?? true,
    isHighlighted: input.isHighlighted ?? false,
    published: false, // designed first, published deliberately
    stripeProductId: sync.stripeProductId,
    stripePriceId: sync.stripePriceId,
    sortOrder: input.sortOrder ?? 100,
  });

  await logPlatformAction(actor, "plan.create", {
    detail: { key, priceMinor, currency, stripeSynced: sync.synced },
  });
  return { ok: true, warning: sync.warning };
}

export async function updatePlan(
  actor: PlatformActor,
  key: string,
  patch: PlanPatch,
): Promise<PlanResult> {
  const invalid = validate(patch);
  if (invalid) return { ok: false, error: invalid };

  const current = await getPlan(key);
  if (!current) return { ok: false, error: "Unknown package." };

  const next = {
    name: patch.name?.trim() ?? current.name,
    description:
      patch.description !== undefined ? patch.description : current.description,
    priceMinor:
      patch.priceMinor !== undefined ? patch.priceMinor : current.priceMinor,
    currency: patch.currency ?? current.currency,
    billingInterval: patch.billingInterval ?? current.billingInterval,
  };

  // Republish to Stripe whenever the commercial terms move.
  const pricingChanged =
    next.priceMinor !== current.priceMinor ||
    next.currency !== current.currency ||
    next.billingInterval !== current.billingInterval ||
    next.name !== current.name;
  const sync = pricingChanged
    ? await syncPlanToStripe(
        {
          key,
          ...next,
          stripeProductId: current.stripeProductId,
          stripePriceId: current.stripePriceId,
        },
        {
          previousPriceMinor: current.priceMinor,
          previousInterval: current.billingInterval,
        },
      )
    : null;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = next.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priceMinor !== undefined) set.priceMinor = patch.priceMinor;
  if (patch.currency !== undefined) set.currency = next.currency;
  if (patch.billingInterval !== undefined)
    set.billingInterval = next.billingInterval;
  if (patch.seatLimit !== undefined) set.seatLimit = patch.seatLimit;
  if (patch.features !== undefined)
    set.features = normaliseFeatures(patch.features);
  if (patch.trialDays !== undefined) set.trialDays = patch.trialDays;
  if (patch.isSellable !== undefined) set.isSellable = patch.isSellable;
  if (patch.isHighlighted !== undefined)
    set.isHighlighted = patch.isHighlighted;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  if (sync) {
    set.stripeProductId = sync.stripeProductId;
    set.stripePriceId = sync.stripePriceId;
  }

  await adminDb.update(plans).set(set).where(eq(plans.key, key));
  await logPlatformAction(actor, "plan.update", {
    detail: { key, ...patch, stripeSynced: sync?.synced ?? "unchanged" },
  });
  return { ok: true, warning: sync?.warning ?? null };
}

/** Publish or withdraw a package from the public pricing page. */
export async function setPlanPublished(
  actor: PlatformActor,
  key: string,
  published: boolean,
): Promise<PlanResult> {
  const row = await getPlan(key);
  if (!row) return { ok: false, error: "Unknown package." };
  if (published) {
    const blocker = publishBlockers(row);
    if (blocker) return { ok: false, error: blocker };
  }
  await adminDb
    .update(plans)
    .set({ published, updatedAt: new Date() })
    .where(eq(plans.key, key));
  await logPlatformAction(
    actor,
    published ? "plan.publish" : "plan.unpublish",
    {
      detail: { key },
    },
  );
  return { ok: true };
}

/**
 * Retire a package: hidden everywhere and no longer sellable. Existing
 * subscribers are untouched, so nobody loses access mid-term.
 */
export async function archivePlan(
  actor: PlatformActor,
  key: string,
): Promise<PlanResult> {
  const row = await getPlan(key);
  if (!row) return { ok: false, error: "Unknown package." };
  await adminDb
    .update(plans)
    .set({
      archivedAt: new Date(),
      published: false,
      isSellable: false,
      updatedAt: new Date(),
    })
    .where(eq(plans.key, key));
  await logPlatformAction(actor, "plan.archive", { detail: { key } });
  return { ok: true };
}
