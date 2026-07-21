"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WorkspaceActions({
  id,
  suspended,
}: {
  id: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setSuspend(action: "suspend" | "unsuspend") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(
        action === "suspend" ? "Workspace suspended" : "Suspension lifted",
      );
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function impersonate() {
    const reason = window.prompt(
      "Reason for impersonating this workspace owner? (recorded in the audit log)",
    );
    if (reason == null) return;
    if (reason.trim().length < 3) {
      toast.error("A reason of at least 3 characters is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      window.location.href = data.redirect ?? "/dashboard";
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="outline" disabled={busy} onClick={impersonate}>
        Impersonate
      </Button>
      {suspended ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setSuspend("unsuspend")}
        >
          Unsuspend
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => setSuspend("suspend")}
        >
          Suspend
        </Button>
      )}
    </div>
  );
}
