"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

// Global module kill-switches. A module toggled OFF is hidden platform-wide.
// Stored as feature flags "module.<key>": false (absent/true = enabled).
export function ModuleFlags({
  modules,
  disabled,
}: {
  modules: { key: string; title: string }[];
  disabled: string[];
}) {
  const router = useRouter();
  const [off, setOff] = useState<Set<string>>(new Set(disabled));
  const [busy, setBusy] = useState(false);

  async function toggle(key: string, enabled: boolean) {
    const next = new Set(off);
    if (enabled) next.delete(key);
    else next.add(key);
    setOff(next);
    setBusy(true);
    try {
      const featureFlags: Record<string, boolean> = {};
      for (const k of next) featureFlags[`module.${k}`] = false;
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureFlags }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setOff(new Set(disabled)); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {modules.map((m) => {
        const enabled = !off.has(m.key);
        return (
          <label
            key={m.key}
            className="flex items-center justify-between gap-3 py-1.5 text-sm"
          >
            <span className="text-foreground">{m.title}</span>
            <Switch
              checked={enabled}
              disabled={busy}
              onCheckedChange={(v) => toggle(m.key, v === true)}
            />
          </label>
        );
      })}
    </div>
  );
}
