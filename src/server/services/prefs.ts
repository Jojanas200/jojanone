import { eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { userPreferences } from "../db/schema";

// Per-user UI preferences (theme). Read/written under the caller's RLS context.

export const THEMES = ["default", "dark", "neumorph"] as const;
export type ThemeName = (typeof THEMES)[number];

export function normaliseTheme(t: unknown): ThemeName {
  return THEMES.includes(t as ThemeName) ? (t as ThemeName) : "default";
}

/**
 * The user's saved theme, or null if they have never set one (so the client can
 * keep whatever the browser already shows instead of forcing a default).
 */
export async function getUserTheme(
  claims: UserClaims,
): Promise<ThemeName | null> {
  return withUser(claims, async (tx) => {
    const row = (
      await tx
        .select({ theme: userPreferences.theme })
        .from(userPreferences)
        .where(eq(userPreferences.userId, claims.sub))
        .limit(1)
    )[0];
    return row ? normaliseTheme(row.theme) : null;
  });
}

export async function setUserTheme(
  claims: UserClaims,
  theme: string,
): Promise<ThemeName> {
  const t = normaliseTheme(theme);
  await withUser(claims, (tx) =>
    tx
      .insert(userPreferences)
      .values({ userId: claims.sub, theme: t })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { theme: t, updatedAt: new Date() },
      }),
  );
  return t;
}

// --- Notification + Jova preferences (drive real behaviour) ------------------

export const DIGEST_FREQUENCIES = ["daily", "weekly", "off"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];
export const JOVA_STYLES = ["concise", "detailed"] as const;
export type JovaStyle = (typeof JOVA_STYLES)[number];

const normDigest = (v: unknown): DigestFrequency =>
  DIGEST_FREQUENCIES.includes(v as DigestFrequency)
    ? (v as DigestFrequency)
    : "daily";
const normStyle = (v: unknown): JovaStyle =>
  JOVA_STYLES.includes(v as JovaStyle) ? (v as JovaStyle) : "concise";

export async function getUserPrefs(claims: UserClaims): Promise<{
  digestFrequency: DigestFrequency;
  jovaStyle: JovaStyle;
}> {
  return withUser(claims, async (tx) => {
    const row = (
      await tx
        .select({
          digestFrequency: userPreferences.digestFrequency,
          jovaStyle: userPreferences.jovaStyle,
        })
        .from(userPreferences)
        .where(eq(userPreferences.userId, claims.sub))
        .limit(1)
    )[0];
    return {
      digestFrequency: normDigest(row?.digestFrequency),
      jovaStyle: normStyle(row?.jovaStyle),
    };
  });
}

export async function setUserPrefs(
  claims: UserClaims,
  input: { digestFrequency?: string; jovaStyle?: string },
) {
  const patch: Record<string, string> = {};
  if (input.digestFrequency !== undefined)
    patch.digestFrequency = normDigest(input.digestFrequency);
  if (input.jovaStyle !== undefined)
    patch.jovaStyle = normStyle(input.jovaStyle);
  await withUser(claims, (tx) =>
    tx
      .insert(userPreferences)
      .values({ userId: claims.sub, ...patch })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...patch, updatedAt: new Date() },
      }),
  );
  return getUserPrefs(claims);
}
