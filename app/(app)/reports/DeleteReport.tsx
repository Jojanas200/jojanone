"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteReport({ id }: { id: string }) {
  const router = useRouter();
  async function remove() {
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Snapshot deleted");
      router.refresh();
    } else {
      toast.error("Could not delete");
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete snapshot"
      onClick={remove}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
