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
export const planUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    priceMinor: z.number().int().min(0).max(100_000_00).nullable().optional(),
    seatLimit: z.number().int().min(1).max(100_000).nullable().optional(),
    isSellable: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to change.",
  });

export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

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
