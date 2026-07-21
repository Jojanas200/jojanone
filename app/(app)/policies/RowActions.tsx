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

// draft -> active (publish/in force) -> archived; can revert to draft.
const STATUSES: { value: string; label: string }[] = [
  { value: "draft", label: "Mark draft" },
  { value: "active", label: "Publish (active)" },
  { value: "archived", label: "Archive" },
];

export function RowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function setStatus(next: string) {
    const res = await fetch(`/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success(`Policy ${next === "active" ? "published" : next}`);
      router.refresh();
    } else {
      toast.error("Could not update");
    }
  }

  async function remove() {
    if (!window.confirm("Delete this policy? This cannot be undone.")) return;
    const res = await fetch(`/api/policies/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Policy removed");
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
        {STATUSES.filter((s) => s.value !== status).map((s) => (
          <DropdownMenuItem key={s.value} onClick={() => setStatus(s.value)}>
            {s.label}
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
