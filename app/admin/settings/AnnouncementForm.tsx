"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVELS = ["info", "warning", "critical"] as const;

// Tenant-facing announcement banner shown to every workspace.
export function AnnouncementForm({
  initial,
}: {
  initial: { announcement: string | null; level: string };
}) {
  const router = useRouter();
  const [text, setText] = useState(initial.announcement ?? "");
  const [level, setLevel] = useState(initial.level || "info");
  const [saving, setSaving] = useState(false);

  async function save(clear = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement: clear ? null : text.trim() || null,
          announcementLevel: level,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      if (clear) setText("");
      toast.success(clear ? "Announcement cleared" : "Announcement published");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ann">Message (shown to all tenants)</Label>
        <textarea
          id="ann"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="e.g. Scheduled maintenance on Sunday 02:00-03:00 UK time."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1.5">
          <Label>Severity</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => save(false)} disabled={saving || !text.trim()}>
          {saving ? "Saving…" : "Publish"}
        </Button>
        {initial.announcement && (
          <Button
            variant="outline"
            onClick={() => save(true)}
            disabled={saving}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
