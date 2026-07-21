"use client";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function setStatus(next: string) {
    const res = await fetch(`/api/gdpr/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success(next === "archived" ? "Archived" : "Reactivated");
      router.refresh();
    } else {
      toast.error("Could not update");
    }
  }

  async function remove() {
    const res = await fetch(`/api/gdpr/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Activity removed");
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
        {status === "active" ? (
          <DropdownMenuItem onClick={() => setStatus("archived")}>
            Archive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setStatus("active")}>
            Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={remove}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
