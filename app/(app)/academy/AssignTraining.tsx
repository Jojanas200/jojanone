"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogueCourse } from "./Catalogue";

// Assign a course to a named team member (not just the owner). The learner id
// is the slugged name so their assignments group together.
export function AssignTraining({ courses }: { courses: CatalogueCourse[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    courseId: courses[0]?.id ?? "",
    learnerName: "",
    dueDate: "",
    reason: "",
    legallyRequired: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = f.learnerName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        courseId: f.courseId,
        learnerId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        learnerName: name,
        legallyRequired: f.legallyRequired,
      };
      if (f.dueDate) payload.dueDate = f.dueDate;
      if (f.reason.trim()) payload.reason = f.reason.trim();
      const res = await fetch("/api/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(`Assigned to ${name}`);
      setOpen(false);
      setF((p) => ({ ...p, learnerName: "", dueDate: "", reason: "" }));
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
        <Button variant="outline" size="sm">
          Assign training
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign training</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select
              value={f.courseId}
              onValueChange={(v) => setF((p) => ({ ...p, courseId: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="learnerName">Team member</Label>
              <Input
                id="learnerName"
                required
                value={f.learnerName}
                onChange={(e) =>
                  setF((p) => ({ ...p, learnerName: e.target.value }))
                }
                placeholder="Sam Taylor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={f.dueDate}
                onChange={(e) =>
                  setF((p) => ({ ...p, dueDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={f.reason}
              onChange={(e) => setF((p) => ({ ...p, reason: e.target.value }))}
              placeholder="New starter induction / role requirement"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="legally">Legally required training</Label>
            <Switch
              id="legally"
              checked={f.legallyRequired}
              onCheckedChange={(v) =>
                setF((p) => ({ ...p, legallyRequired: v === true }))
              }
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
