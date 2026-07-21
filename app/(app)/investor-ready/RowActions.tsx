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

const STATUSES = [
  "ready",
  "in_progress",
  "needs_review",
  "missing",
  "not_applicable",
] as const;

export function RowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function setStatus(next: string) {
    const res = await fetch(`/api/investor-ready/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success(`Marked ${next.replace(/_/g, " ")}`);
      router.refresh();
    } else {
      toast.error("Could not update");
    }
  }

  async function remove() {
    const res = await fetch(`/api/investor-ready/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Item removed");
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
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        {STATUSES.filter((s) => s !== status).map((s) => (
          <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
            {s.replace(/_/g, " ")}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={remove}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
