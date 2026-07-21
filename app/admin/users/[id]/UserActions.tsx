"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function UserActions({
  id,
  email,
  disabled,
  confirmed,
}: {
  id: string;
  email: string | null;
  disabled: boolean;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function run(action: string, opts?: { confirm?: string }) {
    if (opts?.confirm && !window.confirm(opts.confirm)) return;
    setBusy(true);
    setLink(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      if (data.link) {
        setLink(data.link);
        toast.success("Recovery link generated");
      } else {
        toast.success("Done");
      }
      if (action === "erase") {
        router.push("/admin/users");
        return;
      }
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!confirmed && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run("confirm")}
          >
            Confirm email
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !email}
          onClick={() => run("recovery")}
        >
          Password reset link
        </Button>
        {disabled ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run("enable")}
          >
            Enable account
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run("disable", {
                confirm: `Disable ${email ?? "this account"}? They will be unable to sign in.`,
              })
            }
          >
            Disable account
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            run("erase", {
              confirm: `GDPR ERASE ${email ?? "this user"}? This deletes their account, memberships and preferences. This cannot be undone.`,
            })
          }
        >
          Erase (GDPR)
        </Button>
      </div>
      {link && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-foreground">
            Recovery link (send securely to the user):
          </p>
          <p className="break-all text-xs text-muted-foreground">{link}</p>
        </div>
      )}
    </div>
  );
}
