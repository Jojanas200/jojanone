"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Employee = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
};

export function AssignAck({
  policyId,
  employees,
}: {
  policyId: string;
  employees: Employee[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function assign(body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/acknowledgements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      const { created } = (await res.json()) as { created: number };
      toast.success(
        created > 0
          ? `Assigned to ${created} ${created === 1 ? "person" : "people"}`
          : "Everyone selected is already assigned",
      );
      setOpen(false);
      setPicked(new Set());
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Assign staff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign policy for sign-off</DialogTitle>
        </DialogHeader>

        {employees.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Every active employee is already assigned. Add people in the HR
            module to assign more.
          </p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
            {employees.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={picked.has(e.id)}
                  onCheckedChange={() => toggle(e.id)}
                />
                <span className="flex-1">
                  <span className="text-sm font-medium text-foreground">
                    {e.fullName}
                  </span>
                  {e.jobTitle ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.jobTitle}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={loading || employees.length === 0}
            onClick={() => assign({ allActive: true })}
          >
            Assign all active staff
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={loading || picked.size === 0}
              onClick={() => assign({ employeeIds: [...picked] })}
            >
              {loading ? "Assigning…" : `Assign ${picked.size || ""}`.trim()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
