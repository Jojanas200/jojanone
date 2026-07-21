"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type CatalogueCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  difficulty: string;
};

export function Catalogue({
  courses,
  assignedIds,
}: {
  courses: CatalogueCourse[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const assigned = new Set(assignedIds);

  async function assign(courseId: string) {
    setBusy(courseId);
    try {
      const res = await fetch("/api/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, learnerId: "owner" }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Course added to your learning");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {courses.map((c) => {
        const isAssigned = assigned.has(c.id);
        return (
          <Card key={c.id} className="flex flex-col p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <Badge variant="outline">{c.category}</Badge>
              <span className="text-xs text-muted-foreground">
                {c.duration} min · {c.difficulty}
              </span>
            </div>
            <h3 className="font-medium text-foreground">{c.title}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {c.description}
            </p>
            <div className="mt-4">
              {isAssigned ? (
                <Button variant="outline" disabled className="w-full">
                  In your learning
                </Button>
              ) : (
                <Button
                  onClick={() => assign(c.id)}
                  disabled={busy === c.id}
                  className="w-full"
                >
                  {busy === c.id ? "Adding…" : "Add to my learning"}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
