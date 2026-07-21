"use client";
import { useEffect } from "react";

// For a signed-in user with a saved theme, make the account preference the
// source of truth on app load - so a device that has never seen their choice
// (no cookie/localStorage yet) adopts it. Renders nothing. Does nothing when
// the user has no saved preference (dbTheme null), leaving the browser's value.
export function ThemeSync({ dbTheme }: { dbTheme: string | null }) {
  useEffect(() => {
    if (!dbTheme) return;
    if (document.documentElement.getAttribute("data-theme") === dbTheme) return;
    document.documentElement.setAttribute("data-theme", dbTheme);
    try {
      localStorage.setItem("jj-theme", dbTheme);
      document.cookie = `jj-theme=${dbTheme};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // ignore
    }
  }, [dbTheme]);
  return null;
}
