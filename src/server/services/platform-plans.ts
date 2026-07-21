import { asc, eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { plans } from "../db/schema";
import { logPlatformAction, type PlatformActor } from "./platform-admin";

// Plan catalogue management (operators). Edits the plans that billing, pricing
// and seat enforcement all read. Stripe price IDs stay env/Stripe-managed.

export interface PlanRow {
  key: string;
  name: string;
  priceMinor: number | null;
  currency: string;
  seatLimit: number | null;
  isSellable: boolean;
  sortOrder: number;
}

export async function listPlansFull(): Promise<PlanRow[]> {
  const rows = await adminDb
    .select({
      key: plans.key,
      name: plans.name,
      priceMinor: plans.priceMinor,
      currency: plans.currency,
      seatLimit: plans.seatLimit,
      isSellable: plans.isSellable,
      sortOrder: plans.sortOrder,
    })
    .from(plans)
    .orderBy(asc(plans.sortOrder));
  return rows.map((r) => ({ ...r, priceMinor: r.priceMinor ?? null }));
}

export interface PlanPatch {
  name?: string;
  priceMinor?: number | null;
  seatLimit?: number | null;
  isSellable?: boolean;
}

export type PlanResult = { ok: true } | { ok: false; error: string };

export async function updatePlan(
  actor: PlatformActor,
  key: string,
  patch: PlanPatch,
): Promise<PlanResult> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { ok: false, error: "Name is required." };
    set.name = patch.name.trim();
  }
  if (patch.priceMinor !== undefined) {
    if (patch.priceMinor !== null && patch.priceMinor < 0)
      return { ok: false, error: "Price cannot be negative." };
    set.priceMinor = patch.priceMinor;
  }
  if (patch.seatLimit !== undefined) {
    if (patch.seatLimit !== null && patch.seatLimit < 1)
      return { ok: false, error: "Seat limit must be at least 1 (or blank)." };
    set.seatLimit = patch.seatLimit;
  }
  if (patch.isSellable !== undefined) set.isSellable = patch.isSellable;
  if (Object.keys(set).length === 0)
    return { ok: false, error: "Nothing to change." };

  const updated = await adminDb
    .update(plans)
    .set(set)
    .where(eq(plans.key, key))
    .returning({ key: plans.key });
  if (!updated.length) return { ok: false, error: "Unknown plan." };

  await logPlatformAction(actor, "plan.update", {
    detail: { key, ...patch } as Record<string, unknown>,
  });
  return { ok: true };
}
