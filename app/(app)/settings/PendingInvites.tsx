"use client";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Invite = {
  id: string;
  email: string;
  role: string;
  scopedModules: string[] | null;
  expiresAt: string | Date;
};

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    // Pin the zone so server-render and client-hydration produce identical text.
    timeZone: "Europe/London",
  });

export function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();

  async function revoke(id: string) {
    const res = await fetch(`/api/team/invite/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Invitation revoked");
      router.refresh();
    } else {
      toast.error("Could not revoke");
    }
  }

  async function resend(id: string) {
    const res = await fetch(`/api/team/invite/${id}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(
        data.emailSent
          ? "Invitation re-sent with a fresh link"
          : "Invite link refreshed (email could not be sent)",
      );
      router.refresh();
    } else {
      toast.error(data?.error ?? "Could not resend");
    }
  }

  if (invites.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Pending invitations
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {invites.map((i) => (
          <li
            key={i.id}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-foreground">
              {i.email}
            </span>
            {i.role === "adviser" && (
              <Badge variant="secondary" className="font-normal">
                {i.scopedModules?.length
                  ? `${i.scopedModules.length} module${i.scopedModules.length === 1 ? "" : "s"}`
                  : "all modules"}
              </Badge>
            )}
            <Badge variant="outline">{i.role.replace(/_/g, " ")}</Badge>
            <span className="text-xs text-muted-foreground">
              expires {fmtDate(i.expiresAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => resend(i.id)}
            >
              Resend
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Revoke invite for ${i.email}`}
              onClick={() => revoke(i.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
