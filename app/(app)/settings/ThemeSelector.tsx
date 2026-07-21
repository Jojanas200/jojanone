"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// Direct theme picker for Settings (a discoverable home for the preference).
// Applies via data-theme on <html> and persists to cookie + localStorage + the
// user's account, so the choice carries across the app, the landing, and other
// devices. Mirrors the header ThemeSwitcher's persistence.

type Theme = "default" | "dark" | "neumorph";

const OPTIONS: {
  id: Theme;
  name: string;
  desc: string;
  swatch: [string, string, string];
}[] = [
  {
    id: "default",
    name: "Classic",
    desc: "The original light theme.",
    swatch: ["#ffffff", "#2563eb", "#1b2a4a"],
  },
  {
    id: "dark",
    name: "Dark",
    desc: "Easy on the eyes in low light.",
    swatch: ["#0d1424", "#7c74ff", "#eef2f7"],
  },
  {
    id: "neumorph",
    name: "Soft UI",
    desc: "Tactile, soft-shadowed surfaces.",
    swatch: ["#e0e5ec", "#6c63ff", "#3d4852"],
  },
];

function current(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" || t === "neumorph" ? t : "default";
}

export function ThemeSelector() {
  const [active, setActive] = useState<Theme>("default");

  useEffect(() => {
    setActive(current());
  }, []);

  function apply(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jj-theme", next);
      document.cookie = `jj-theme=${next};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // ignore storage/cookie failures
    }
    fetch("/api/prefs/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
      keepalive: true,
    }).catch(() => {});
    setActive(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid gap-3 sm:grid-cols-3"
    >
      {OPTIONS.map((o) => {
        const selected = active === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => apply(o.id)}
            className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className="flex overflow-hidden rounded-full border border-border"
                aria-hidden="true"
              >
                {o.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-6 w-6"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {selected && <Check className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{o.name}</p>
              <p className="text-xs text-muted-foreground">{o.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
