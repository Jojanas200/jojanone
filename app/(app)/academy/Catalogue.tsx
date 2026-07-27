"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CatalogueCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  difficulty: string;
  /** 0-100 when the learner has started the course. */
  progressPct?: number | null;
  completed?: boolean;
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
  const [search, setSearch] = useState("");
  const [categoryF, setCategoryF] = useState("all");
  const [difficultyF, setDifficultyF] = useState("all");
  const assigned = new Set(assignedIds);

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category))).sort(),
    [courses],
  );
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (categoryF !== "all" && c.category !== categoryF) return false;
      if (difficultyF !== "all" && c.difficulty !== difficultyF) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [courses, search, categoryF, difficultyF]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="pl-8"
          />
        </div>
        <Select value={categoryF} onValueChange={setCategoryF}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficultyF} onValueChange={setDifficultyF}>
          <SelectTrigger className="w-40 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any level</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {shown.length} of {courses.length}
        </span>
      </div>
      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No courses match your search.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((c) => {
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
                {c.completed ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={100} className="h-1.5" />
                    <Badge variant="success" className="shrink-0">
                      Completed
                    </Badge>
                  </div>
                ) : c.progressPct != null && c.progressPct > 0 ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={c.progressPct} className="h-1.5" />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.progressPct}%
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/academy/${c.id}`}>
                      {isAssigned ? "Continue" : "Open course"}
                    </Link>
                  </Button>
                  {!isAssigned && (
                    <Button
                      onClick={() => assign(c.id)}
                      disabled={busy === c.id}
                      className="flex-1"
                    >
                      {busy === c.id ? "Adding…" : "Add to my learning"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
