"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ADVISER_SCOPABLE_MODULES } from "@/config/modules.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES = ["team_member", "manager", "read_only", "adviser"] as const;

export function InviteTeammate({ seatsAvailable }: { seatsAvailable: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("team_member");
  const [scoped, setScoped] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (seatsAvailable <= 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
        No seats available. Upgrade your plan on the{" "}
        <a href="/billing" className="underline">
          Billing
        </a>{" "}
        page to invite teammates.
      </p>
    );
  }

  function toggleModule(key: string, on: boolean) {
    setScoped((prev) =>
      on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          // Only send a scope for advisers; empty = full access.
          scopedModules: role === "adviser" ? scoped : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      if (data.emailSkipped) {
        toast.success(
          "Invite created - email isn't connected, so share the link manually.",
        );
      } else if (data.emailSent) {
        toast.success("Invitation sent");
      } else {
        toast.success("Invite created (email delivery failed - resend later).");
      }
      setEmail("");
      setScoped([]);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="inv-email">Invite by email</Label>
          <Input
            id="inv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.co.uk"
          />
        </div>
        <div className="w-40 space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading || !email.trim()}>
          {loading ? "Sending…" : "Send invite"}
        </Button>
      </div>

      {role === "adviser" && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            Limit adviser to specific modules
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Advisers get read-only access. Choose which modules they can see -
            leave all unchecked to give access to everything. Settings is always
            available.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {ADVISER_SCOPABLE_MODULES.map((m) => {
              const id = `scope-${m.key}`;
              return (
                <label
                  key={m.key}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    id={id}
                    checked={scoped.includes(m.key)}
                    onCheckedChange={(v) => toggleModule(m.key, v === true)}
                  />
                  {m.title}
                </label>
              );
            })}
          </div>
          {scoped.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              This adviser will see {scoped.length} module
              {scoped.length === 1 ? "" : "s"} plus Settings.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
