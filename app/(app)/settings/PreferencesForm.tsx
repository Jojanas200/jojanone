"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// These preferences drive real behaviour: the digest frequency is read by the
// reminder email sender, and the Jova style shapes the ask pipeline's prompt.
export function PreferencesForm({
  initial,
}: {
  initial: { digestFrequency: string; jovaStyle: string };
}) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Preferences saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Notifications
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How often the reminder digest email reaches you when there are
            unread notifications.
          </p>
        </div>
        <div className="max-w-xs space-y-1.5">
          <Label>Email digest</Label>
          <Select
            value={f.digestFrequency}
            onValueChange={(v) => setF((p) => ({ ...p, digestFrequency: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly (Mondays)</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Jova</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How Jova writes its answers. Safeguards (grounding in your data, no
            regulated advice, escalation) always apply and cannot be turned off.
          </p>
        </div>
        <div className="max-w-xs space-y-1.5">
          <Label>Response style</Label>
          <Select
            value={f.jovaStyle}
            onValueChange={(v) => setF((p) => ({ ...p, jovaStyle: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concise">
                Concise - lead with the answer
              </SelectItem>
              <SelectItem value="detailed">
                Detailed - include context
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
