"use client";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUSES: { value: string; label: string }[] = [
  { value: "acknowledged", label: "Mark acknowledged" },
  { value: "waived", label: "Mark not applicable" },
  { value: "pending", label: "Reset to pending" },
];

export function AckRowActions({
  policyId,
  ackId,
  status,
}: {
  policyId: string;
  ackId: string;
  status: string;
}) {
  const router = useRouter();
  const base = `/api/policies/${policyId}/acknowledgements/${ackId}`;

  async function setStatus(next: string) {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success("Sign-off updated");
      router.refresh();
    } else {
      toast.error("Could not update");
    }
  }

  async function remove() {
    if (!window.confirm("Remove this person from the policy roster?")) return;
    const res = await fetch(base, { method: "DELETE" });
    if (res.ok) {
      toast.success("Removed from roster");
      router.refresh();
    } else {
      toast.error("Could not remove");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sign-off</DropdownMenuLabel>
        {STATUSES.filter((s) => s.value !== status).map((s) => (
          <DropdownMenuItem key={s.value} onClick={() => setStatus(s.value)}>
            {s.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={remove}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
