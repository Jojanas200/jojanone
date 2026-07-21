import { eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { platformSettings } from "../db/schema";
import {
  ANTHROPIC_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_MODEL,
  type AiProviderKey,
} from "../ai/provider";
import { logPlatformAction, type PlatformActor } from "./platform-admin";

// Cross-tenant platform configuration (single row). Read/written with the
// service role behind the platform-admin allowlist. Reads are cached briefly
// so the hot AI path does not hit the DB on every call; writes bust the cache.

export type FeatureFlags = Record<string, boolean>;

export interface PlatformSettings {
  aiProvider: string;
  aiModel: string | null;
  signupsEnabled: boolean;
  announcement: string | null;
  announcementLevel: string;
  featureFlags: FeatureFlags;
  updatedAt: Date;
  updatedByEmail: string | null;
}

const DEFAULTS: PlatformSettings = {
  aiProvider: "anthropic",
  aiModel: null,
  signupsEnabled: true,
  announcement: null,
  announcementLevel: "info",
  featureFlags: {},
  updatedAt: new Date(0),
  updatedByEmail: null,
};

const CACHE_TTL_MS = 30_000;
let cache: { value: PlatformSettings; expires: number } | null = null;

export function clearPlatformSettingsCache() {
  cache = null;
}

export async function getPlatformSettings(
  now: number = Date.now(),
): Promise<PlatformSettings> {
  if (cache && cache.expires > now) return cache.value;
  const row = (
    await adminDb
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, "singleton"))
      .limit(1)
  )[0];
  const value: PlatformSettings = row
    ? {
        aiProvider: row.aiProvider,
        aiModel: row.aiModel,
        signupsEnabled: row.signupsEnabled,
        announcement: row.announcement,
        announcementLevel: row.announcementLevel,
        featureFlags: (row.featureFlags ?? {}) as FeatureFlags,
        updatedAt: row.updatedAt,
        updatedByEmail: row.updatedByEmail,
      }
    : { ...DEFAULTS };
  cache = { value, expires: now + CACHE_TTL_MS };
  return value;
}

export interface PlatformSettingsPatch {
  aiProvider?: string;
  aiModel?: string | null;
  signupsEnabled?: boolean;
  announcement?: string | null;
  announcementLevel?: string;
  featureFlags?: FeatureFlags;
}

/** Update the singleton (platform admin only) and write an audit entry. */
export async function updatePlatformSettings(
  actor: PlatformActor,
  patch: PlatformSettingsPatch,
): Promise<PlatformSettings> {
  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: actor.sub,
    updatedByEmail: actor.email,
  };
  if (patch.aiProvider !== undefined) set.aiProvider = patch.aiProvider;
  if (patch.aiModel !== undefined)
    set.aiModel = patch.aiModel?.trim() ? patch.aiModel.trim() : null;
  if (patch.signupsEnabled !== undefined)
    set.signupsEnabled = patch.signupsEnabled;
  if (patch.announcement !== undefined)
    set.announcement = patch.announcement?.trim()
      ? patch.announcement.trim()
      : null;
  if (patch.announcementLevel !== undefined)
    set.announcementLevel = patch.announcementLevel;
  if (patch.featureFlags !== undefined) set.featureFlags = patch.featureFlags;

  // Upsert-safe: the row is seeded by migration, but guard against a missing one.
  await adminDb
    .insert(platformSettings)
    .values({ id: "singleton", ...set })
    .onConflictDoUpdate({ target: platformSettings.id, set });

  clearPlatformSettingsCache();
  await logPlatformAction(actor, "settings.update", {
    detail: { ...patch } as Record<string, unknown>,
  });
  return getPlatformSettings();
}

/** Effective AI provider + model for the Jova path (resolves the default model). */
export async function getActiveAiConfig(): Promise<{
  provider: AiProviderKey;
  model: string | null;
}> {
  const s = await getPlatformSettings();
  const provider = (
    ["anthropic", "openrouter", "deterministic"].includes(s.aiProvider)
      ? s.aiProvider
      : "anthropic"
  ) as AiProviderKey;
  return { provider, model: s.aiModel };
}

/** The model that WOULD be used, for display (resolves null to the default). */
export function effectiveModel(provider: string, model: string | null): string {
  if (model?.trim()) return model.trim();
  if (provider === "openrouter") return OPENROUTER_DEFAULT_MODEL;
  if (provider === "deterministic") return "none";
  return ANTHROPIC_DEFAULT_MODEL;
}

// --- Feature flags (module kill-switches) ------------------------------------
// A flag "module.<key>" set to false disables that module platform-wide. Absent
// or true = enabled (so the default is always on).
export const flagKey = (moduleKey: string) => `module.${moduleKey}`;

export function isModuleGloballyEnabled(
  flags: FeatureFlags,
  moduleKey: string,
): boolean {
  return flags[flagKey(moduleKey)] !== false;
}

/** Module keys explicitly disabled by a flag. */
export function disabledModuleKeys(flags: FeatureFlags): string[] {
  return Object.entries(flags)
    .filter(([k, v]) => k.startsWith("module.") && v === false)
    .map(([k]) => k.slice("module.".length));
}

/** Fetch just the disabled-module set (cached via getPlatformSettings). */
export async function getDisabledModules(): Promise<string[]> {
  try {
    const s = await getPlatformSettings();
    return disabledModuleKeys(s.featureFlags);
  } catch {
    return [];
  }
}
