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
