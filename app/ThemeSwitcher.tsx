"use client";
import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

// Selectable theme cycle: Classic -> Dark -> Soft UI. The theme applies via
// `data-theme` on <html> and is stored in the jj-theme cookie + localStorage
// (read by a no-flash script in the root layout) and, when signed in, persisted
// to the user's account so it follows them across devices.

const THEMES = ["default", "dark", "neumorph"] as const;
type Theme = (typeof THEMES)[number];
const LABEL: Record<Theme, string> = {
  default: "Classic",
  dark: "Dark",
  neumorph: "Soft UI",
};

function current(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" || t === "neumorph" ? t : "default";
}

export function ThemeSwitcher({
  className = "",
  persist = false,
}: {
  className?: string;
  /** Save the choice to the signed-in user's account. Pass true only where the
   * user is authenticated (app / admin / onboarding), so logged-out surfaces
   * (landing, sign-in) don't fire a doomed 401 - they keep the choice in the
   * cookie + localStorage, which is all a logged-out visitor needs. */
  persist?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("default");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(current());
    setReady(true);
  }, []);

  function apply(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jj-theme", next);
      document.cookie = `jj-theme=${next};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // ignore storage/cookie failures (private mode etc.)
    }
    // Persist to the account only when signed in.
    if (persist) {
      fetch("/api/prefs/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
        keepalive: true,
      }).catch(() => {});
    }
    setTheme(next);
  }

  const next: Theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
      title={
        ready ? `Theme: ${LABEL[theme]} - click for ${LABEL[next]}` : "Theme"
      }
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      <Palette className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{ready ? LABEL[theme] : "Theme"}</span>
    </button>
  );
}
