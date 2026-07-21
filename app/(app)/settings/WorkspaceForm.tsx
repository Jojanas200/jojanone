"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A pragmatic subset of IANA zones relevant to UK small businesses.
const TIME_ZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "UTC",
  "America/New_York",
] as const;

export function WorkspaceForm({
  workspace,
}: {
  workspace: { name: string; brandColor: string | null; timeZone: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    name: workspace.name,
    brandColor: workspace.brandColor ?? "#4f46e5",
    timeZone: workspace.timeZone,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          brandColor: f.brandColor,
          timeZone: f.timeZone,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Workspace saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input
          id="ws-name"
          required
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ws-color">Brand colour</Label>
        <div className="flex items-center gap-3">
          <input
            id="ws-color"
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={f.brandColor}
            onChange={(e) =>
              setF((p) => ({ ...p, brandColor: e.target.value }))
            }
          />
          <Input
            aria-label="Brand colour hex"
            value={f.brandColor}
            onChange={(e) =>
              setF((p) => ({ ...p, brandColor: e.target.value }))
            }
            className="max-w-[8rem]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ws-tz">Time zone</Label>
        <select
          id="ws-tz"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={f.timeZone}
          onChange={(e) => setF((p) => ({ ...p, timeZone: e.target.value }))}
        >
          {TIME_ZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save workspace"}
        </Button>
      </div>
    </form>
  );
}
