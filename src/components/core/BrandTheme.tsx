import { useEffect } from "react";
import { useCoreData } from "@/data/store";

/**
 * Applies the user's saved Primary Brand Colour to the shared theme by
 * overriding CSS custom properties on <html>. Only interactive/accent tokens
 * are recoloured - semantic status colours, body text and page backgrounds
 * are intentionally untouched.
 */
export function BrandTheme() {
  const primary = useCoreData((s) => s.app_settings?.branding?.primary_color) || "#2563EB";

  useEffect(() => {
    const root = document.documentElement;
    // Base primary + focus ring
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--info", primary);
    // Subtle tinted background (used for active nav, selected tabs, icon chips)
    root.style.setProperty(
      "--accent",
      `color-mix(in oklab, ${primary} 12%, white)`,
    );
    root.style.setProperty("--accent-foreground", primary);
    // Category accent used by Jova / core surfaces
    root.style.setProperty("--accent-core", primary);
    return () => {
      // No cleanup: keep colour applied across renders.
    };
  }, [primary]);

  return null;
}