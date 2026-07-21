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
    const res = await fetch(`/api/compliance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success(`Marked ${next.replace("_", " ")}`);
      router.refresh();
    } else {
      toast.error("Could not update");
    }
  }

  async function remove() {
    const res = await fetch(`/api/compliance/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Obligation removed");
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
        {status !== "completed" && (
          <DropdownMenuItem onClick={() => setStatus("completed")}>
            Mark complete
          </DropdownMenuItem>
        )}
        {status !== "in_progress" && (
          <DropdownMenuItem onClick={() => setStatus("in_progress")}>
            Mark in progress
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
