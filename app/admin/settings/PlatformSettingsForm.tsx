"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Provider = "anthropic" | "openrouter" | "deterministic";

const PROVIDERS: { value: Provider; label: string; hint: string }[] = [
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    hint: "Direct Anthropic API. Needs ANTHROPIC_API_KEY.",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    hint: "Any OpenRouter-hosted model. Needs OPENROUTER_API_KEY.",
  },
  {
    value: "deterministic",
    label: "Deterministic engine (no LLM)",
    hint: "No model calls. Jova uses its rules-based findings engine only.",
  },
];

export function PlatformSettingsForm({
  initial,
  keyPresent,
  defaultModel,
}: {
  initial: { aiProvider: Provider; aiModel: string; signupsEnabled: boolean };
  keyPresent: Record<string, boolean>;
  defaultModel: Record<string, string>;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>(initial.aiProvider);
  const [model, setModel] = useState(initial.aiModel);
  const [signupsEnabled, setSignupsEnabled] = useState(initial.signupsEnabled);
  const [saving, setSaving] = useState(false);

  const meta = PROVIDERS.find((p) => p.value === provider)!;
  const missingKey = provider !== "deterministic" && !keyPresent[provider];

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: provider,
          aiModel: model.trim(),
          signupsEnabled,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Platform settings saved");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Jova AI provider</Label>
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v as Provider)}
        >
          <SelectTrigger className="w-full sm:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
        {missingKey && (
          <p className="text-xs text-amber-600">
            No API key is configured for this provider - Jova will fall back to
            the deterministic engine until the key is added.
          </p>
        )}
      </div>

      {provider !== "deterministic" && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-model">Model</Label>
          <Input
            id="ai-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={defaultModel[provider]}
            className="w-full sm:w-96"
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the default ({defaultModel[provider]}).
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border p-4 sm:w-96">
        <div>
          <Label htmlFor="signups">New sign-ups enabled</Label>
          <p className="text-xs text-muted-foreground">
            Turn off to pause new workspace registrations.
          </p>
        </div>
        <Switch
          id="signups"
          checked={signupsEnabled}
          onCheckedChange={setSignupsEnabled}
        />
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
