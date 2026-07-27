"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

// Platform kill-switch for Jova's controlled web search. OFF by default -
// while off, Jova is not represented as internet-connected anywhere. The
// full flags map is round-tripped so module kill-switches are preserved.
export function WebSearchToggle({
  enabled,
  providerConfigured,
  providerName,
  allFlags,
}: {
  enabled: boolean;
  providerConfigured: boolean;
  providerName: string;
  allFlags: Record<string, boolean>;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  async function toggle(v: boolean) {
    setOn(v);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureFlags: { ...allFlags, jova_web_search: v },
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(`Jova web search ${v ? "enabled" : "disabled"}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setOn(enabled); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground">
          Allow controlled read-only web search
        </span>
        <Switch
          checked={on}
          disabled={busy}
          onCheckedChange={(v) => toggle(v === true)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Search provider:{" "}
        {providerConfigured
          ? `${providerName} (key present)`
          : "not configured - set WEB_SEARCH_PROVIDER and its API key in the server environment"}
        . Searches run server-side against trusted official sources only
        (GOV.UK, ICO, HSE, EU/US/international regulators), queries are redacted
        before leaving the platform, and every search is logged without personal
        data. Jova cannot browse, submit forms or take any external action.
      </p>
    </div>
  );
}
