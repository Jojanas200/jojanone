import { z } from "zod";

// Platform settings edits (operators only). All fields optional so each admin
// form (AI, announcement, feature flags) can PATCH just its own slice.
export const platformSettingsSchema = z
  .object({
    aiProvider: z.enum(["anthropic", "openrouter", "deterministic"]).optional(),
    aiModel: z.string().trim().max(120).optional(),
    signupsEnabled: z.boolean().optional(),
    announcement: z.string().max(2000).nullable().optional(),
    announcementLevel: z.enum(["info", "warning", "critical"]).optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to change.",
  });

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;

// Plan catalogue edits (operators only).
// A designed package: name, commercial terms, the optional modules it
// unlocks, and an optional time-bound free trial.
const planFields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).nullable(),
  priceMinor: z.number().int().min(0).max(100_000_00).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as GBP."),
  billingInterval: z.enum(["month", "year"]),
  seatLimit: z.number().int().min(1).max(100_000).nullable(),
  features: z.array(z.string().trim().min(1).max(40)).max(40),
  trialDays: z.number().int().min(0).max(365),
  isSellable: z.boolean(),
  isHighlighted: z.boolean(),
  sortOrder: z.number().int().min(0).max(9_999),
};

export const planUpdateSchema = z
  .object({
    name: planFields.name.optional(),
    description: planFields.description.optional(),
    priceMinor: planFields.priceMinor.optional(),
    currency: planFields.currency.optional(),
    billingInterval: planFields.billingInterval.optional(),
    seatLimit: planFields.seatLimit.optional(),
    features: planFields.features.optional(),
    trialDays: planFields.trialDays.optional(),
    isSellable: planFields.isSellable.optional(),
    isHighlighted: planFields.isHighlighted.optional(),
    sortOrder: planFields.sortOrder.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to change.",
  });

export const planCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z][a-z0-9_-]{1,38}$/,
      "Key must start with a letter and use lower-case letters, numbers, dashes or underscores.",
    ),
  name: planFields.name,
  description: planFields.description.optional(),
  priceMinor: planFields.priceMinor,
  currency: planFields.currency.default("GBP"),
  billingInterval: planFields.billingInterval.default("month"),
  seatLimit: planFields.seatLimit.optional(),
  features: planFields.features.default([]),
  trialDays: planFields.trialDays.default(0),
  isSellable: planFields.isSellable.default(true),
  isHighlighted: planFields.isHighlighted.default(false),
  sortOrder: planFields.sortOrder.default(100),
});

export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
export type PlanCreateInput = z.infer<typeof planCreateSchema>;

// Manual subscription/quota override (audited, bypasses Stripe).
export const subscriptionOverrideSchema = z
  .object({
    planKey: z.string().trim().min(1).max(60).optional(),
    status: z.enum(["trialing", "active", "past_due", "canceled"]).optional(),
    seatsAllowed: z.number().int().min(1).max(10000).optional(),
    trialDays: z.number().int().min(1).max(365).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to change.",
  });

export type SubscriptionOverrideInput = z.infer<
  typeof subscriptionOverrideSchema
>;
