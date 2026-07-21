import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Search,
  Printer,
  Copy,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Play,
  UserPlus,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetricCard } from "@/components/core/MetricCard";
import { StatusPill, type Tone } from "@/components/core/StatusPill";
import { EmptyState } from "@/components/core/EmptyState";
import { DetailDrawer } from "@/components/core/DetailDrawer";
import { ConfirmDialog } from "@/components/core/ConfirmDialog";
import {
  useCoreData,
  startCourse,
  assignCourses,
  reassignAssignmentDate,
  markAssignmentExternallyComplete,
  deleteAssignment,
  createConversation,
  appendMessage,
  addReport,
} from "@/data/store";
import {
  COURSES,
  getCourse,
  ACADEMY_DISCLAIMER,
  CERTIFICATE_STATEMENT,
  type Course,
} from "@/data/academy-catalog";
import {
  academyMetrics,
  buildRecommendations,
  listLearners,
  progressFor,
  bestAttempt,
  certificateFor,
  courseCompletionPct,
  findNextIncompleteLessonIndex,
  isAssignmentOverdue,
  isDueSoon,
  CATEGORY_LIST,
} from "@/data/academy-selectors";
import type { AcademyAssignment, LearnerId } from "@/data/types";
import { formatDate } from "@/data/selectors";
import { LessonPanel } from "@/components/academy/LessonPanel";
import { CourseQuizDialog } from "@/components/academy/CourseQuizDialog";
import { printCourseResource } from "@/components/academy/printResource";

export const Route = createFileRoute("/academy")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    c: typeof s.c === "string" ? s.c : undefined,
    l: typeof s.l === "string" ? s.l : undefined,
    learner: typeof s.learner === "string" ? s.learner : undefined,
    cert: typeof s.cert === "string" ? s.cert : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Academy - Jojan One" },
      {
        name: "description",
        content:
          "Build capability, close knowledge gaps and keep a clear learning record.",
      },
    ],
  }),
  component: AcademyPage,
});

type TabKey = "overview" | "library" | "my" | "team" | "certificates";

function tabFromSearch(v: string | undefined): TabKey {
  if (v === "library" || v === "my" || v === "team" || v === "certificates" || v === "overview") return v;
  return "overview";
}

function pctToneRing(pct: number): Tone {
  if (pct >= 100) return "success";
  if (pct > 0) return "info";
  return "neutral";
}

function AcademyPage() {
  const state = useCoreData((s) => s);
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab = tabFromSearch(search.tab);
  const setTab = (t: TabKey) => navigate({ to: "/academy", search: { tab: t } });

  const metrics = useMemo(() => academyMetrics(state), [state]);
  const learners = useMemo(() => listLearners(state), [state]);
  const recommendations = useMemo(() => buildRecommendations(state), [state]);
  const currentLearnerId: LearnerId = "owner";

  // Course drawer
  const [openCourse, setOpenCourse] = useState<string | null>(search.c ?? null);
  const [lessonIndex, setLessonIndex] = useState<number>(search.l ? parseInt(search.l, 10) || 0 : 0);
  const [lessonMode, setLessonMode] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    if (search.c) {
      setOpenCourse(search.c);
      if (search.l !== undefined) {
        setLessonMode(true);
        setLessonIndex(parseInt(search.l, 10) || 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeCourse = () => {
    setOpenCourse(null);
    setLessonMode(false);
    setQuizOpen(false);
    navigate({ to: "/academy", search: { tab } });
  };

  const openCourseDrawer = (id: string, learner: LearnerId = currentLearnerId) => {
    setOpenCourse(id);
    setLessonMode(false);
    setLessonIndex(0);
    navigate({ to: "/academy", search: { tab, c: id, learner } });
  };

  // Ask Jova helper
  const askJova = (question: string, refType?: string, refId?: string) => {
    const cid = createConversation(question.slice(0, 60));
    appendMessage({
      conversation_id: cid,
      sender: "user",
      content: question,
      reference_type: refType ?? null,
      reference_id: refId ?? null,
      suggested_action: null,
    });
    navigate({ to: "/jova", search: { c: cid } });
  };

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForCourse, setAssignForCourse] = useState<string | null>(null);

  const openAssignDialog = (courseId?: string) => {
    setAssignForCourse(courseId ?? null);
    setAssignOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
            <GraduationCap className="h-7 w-7 text-primary" /> Academy
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            Build capability, close knowledge gaps and keep a clear learning record.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTab("library")}>
            <BookOpen className="mr-1.5 h-4 w-4" /> Browse learning
          </Button>
          <Button onClick={() => openAssignDialog()}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Assign training
          </Button>
        </div>
      </div>

      <p className="mt-3 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-3 py-2 text-[12px] text-muted-foreground">
        {ACADEMY_DISCLAIMER}
      </p>

      {/* Metrics */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Overall progress" value={`${metrics.overallProgressPct}%`} icon={GraduationCap} tone={metrics.overallProgressPct >= 80 ? "success" : "default"} />
        <MetricCard label="Courses in progress" value={metrics.inProgress} icon={Clock} tone={metrics.inProgress > 0 ? "warning" : "default"} />
        <MetricCard label="Courses completed" value={metrics.completed} icon={CheckCircle2} tone="success" />
        <MetricCard label="Training overdue" value={metrics.overdue} icon={AlertTriangle} tone={metrics.overdue > 0 ? "danger" : "default"} />
        <MetricCard label="Certificates earned" value={metrics.certificatesEarned} icon={Award} />
        <MetricCard label="Recommended learning" value={metrics.recommendedCount} icon={Sparkles} tone={metrics.recommendedCount > 0 ? "warning" : "default"} />
        <MetricCard label="People with training gaps" value={metrics.peopleWithGaps} icon={AlertTriangle} />
        <MetricCard label="Learning hours" value={`${(metrics.learningMinutes / 60).toFixed(1)}h`} hint="Recorded across all learners" />
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
        {(
          [
            ["overview", "Overview"],
            ["library", "Learning Library"],
            ["my", "My Learning"],
            ["team", "Team Training"],
            ["certificates", "Certificates"],
          ] as [TabKey, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              "border-b-2 px-3 py-2 text-[13px] font-medium transition-colors " +
              (tab === k
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <OverviewTab
            currentLearner={currentLearnerId}
            onOpenCourse={openCourseDrawer}
            recommendations={recommendations}
            onAskJova={askJova}
          />
        )}
        {tab === "library" && (
          <LibraryTab onOpenCourse={openCourseDrawer} currentLearner={currentLearnerId} />
        )}
        {tab === "my" && (
          <MyLearningTab currentLearner={currentLearnerId} onOpenCourse={openCourseDrawer} />
        )}
        {tab === "team" && (
          <TeamTrainingTab
            onOpenCourse={openCourseDrawer}
            onAssign={openAssignDialog}
            onAskJova={askJova}
          />
        )}
        {tab === "certificates" && <CertificatesTab activeId={search.cert} />}
      </div>

      {/* Training Summary shortcut */}
      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex-1">
          <p className="text-[14px] font-medium text-foreground">Training and Learning Summary</p>
          <p className="text-[12px] text-muted-foreground">
            Generate a report of assignments, completions, overdue training, quiz outcomes and certificates.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const am = academyMetrics(state);
            const id = addReport({
              report_type: "training_summary",
              title: `Training and Learning Summary - ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
              reporting_period: "Point in time",
              summary: `${am.completed} completions, ${am.inProgress} in progress, ${am.overdue} overdue. Overall progress ${am.overallProgressPct}%.`,
              sections: listLearners(state)
                .filter((l) => state.academy_assignments.some((a) => a.learner_id === l.id))
                .map((l) => {
                  const assigns = state.academy_assignments.filter((a) => a.learner_id === l.id);
                  return {
                    heading: `${l.name} (${l.role})`,
                    body: `${assigns.length} assignment(s).`,
                    bullets: assigns.map((a) => {
                      const c = getCourse(a.course_id);
                      const q = bestAttempt(state, l.id, a.course_id);
                      return `${c?.title ?? a.course_id} - ${a.status}${q ? ` · best quiz ${q.score}%` : ""}`;
                    }),
                  };
                }),
              metrics: [
                { label: "Overall progress", value: `${am.overallProgressPct}%` },
                { label: "Completed", value: String(am.completed) },
                { label: "In progress", value: String(am.inProgress) },
                { label: "Overdue", value: String(am.overdue) },
                { label: "Certificates", value: String(am.certificatesEarned) },
              ],
              findings: state.academy_assignments
                .filter((a) => isAssignmentOverdue(a))
                .map((a) => `${a.learner_name} - ${getCourse(a.course_id)?.title ?? a.course_id} overdue`),
              priority_actions: buildRecommendations(state)
                .slice(0, 6)
                .map((r) => `Recommend "${getCourse(r.course_id)?.title ?? r.course_id}" - ${r.reason}`),
              source_modules: ["academy", "hr"],
            });
            navigate({ to: "/reports", search: { r: id } });
            toast.success("Training and Learning Summary generated");
          }}
        >
          Generate
        </Button>
      </div>

      {/* Course drawer / lesson */}
      {openCourse && (
        <CourseDrawer
          courseId={openCourse}
          lessonMode={lessonMode}
          lessonIndex={lessonIndex}
          learnerId={currentLearnerId}
          onClose={closeCourse}
          onEnterLesson={(idx) => {
            setLessonMode(true);
            setLessonIndex(idx);
            navigate({ to: "/academy", search: { tab, c: openCourse, l: String(idx) } });
          }}
          onExitLesson={() => {
            setLessonMode(false);
            navigate({ to: "/academy", search: { tab, c: openCourse } });
          }}
          onChangeLessonIndex={(idx) => {
            setLessonIndex(idx);
            navigate({ to: "/academy", search: { tab, c: openCourse, l: String(idx) } });
          }}
          onOpenQuiz={() => setQuizOpen(true)}
          onAskJova={askJova}
          onAssign={() => openAssignDialog(openCourse)}
        />
      )}

      {/* Quiz */}
      {openCourse && quizOpen && (
        <CourseQuizDialog
          courseId={openCourse}
          learnerId={currentLearnerId}
          onClose={() => setQuizOpen(false)}
          onOpenLesson={(idx) => {
            setLessonMode(true);
            setLessonIndex(idx);
            navigate({ to: "/academy", search: { tab, c: openCourse, l: String(idx) } });
          }}
        />
      )}

      {/* Assign dialog */}
      {assignOpen && (
        <AssignDialog
          initialCourseId={assignForCourse}
          learners={learners}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  );
}

// -------------------- Overview Tab --------------------

function OverviewTab({
  currentLearner,
  onOpenCourse,
  recommendations,
  onAskJova,
}: {
  currentLearner: LearnerId;
  onOpenCourse: (id: string) => void;
  recommendations: ReturnType<typeof buildRecommendations>;
  onAskJova: (q: string, refType?: string, refId?: string) => void;
}) {
  const state = useCoreData((s) => s);
  const inProgress = state.academy_progress.filter(
    (p) => p.learner_id === currentLearner && !p.completed_at,
  );
  const upcoming = state.academy_assignments.filter(
    (a) => a.status !== "completed" && a.due_date && new Date(a.due_date).getTime() - Date.now() < 30 * 86400000,
  );
  const overdue = state.academy_assignments.filter(isAssignmentOverdue);
  const recent = [...state.activities]
    .filter((a) => a.module === "academy")
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Continue learning */}
      <section>
        <h2 className="text-[16px] font-semibold text-foreground">Continue learning</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Your current in-progress courses.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {inProgress.length === 0 ? (
            <EmptyState title="Nothing in progress" description="Start a recommended course to begin." />
          ) : (
            inProgress.map((p) => {
              const c = getCourse(p.course_id);
              if (!c) return null;
              const pct = courseCompletionPct(c, p);
              return (
                <Card key={p.id} className="border border-border bg-card p-4 shadow-none">
                  <p className="text-[14px] font-semibold text-foreground">{c.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {p.lessons_completed.length}/{c.lessons.length} lessons · ~{Math.max(1, c.duration_minutes - p.time_minutes)} min remaining
                  </p>
                  <Progress value={pct} className="mt-2 h-1.5" />
                  <Button size="sm" className="mt-3" onClick={() => onOpenCourse(c.id)}>
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Continue
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Recommended */}
      <section>
        <h2 className="text-[16px] font-semibold text-foreground">Recommended for your business</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Deterministic recommendations based on your current business records.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {recommendations.length === 0 ? (
            <EmptyState title="No new recommendations" description="Every current gap has a matching course already in the library." />
          ) : (
            recommendations.map((r) => {
              const c = getCourse(r.course_id);
              if (!c) return null;
              return (
                <Card key={r.course_id} className="border border-border bg-card p-4 shadow-none">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-foreground">{c.title}</p>
                    <StatusPill tone={r.priority === "high" ? "danger" : r.priority === "medium" ? "warning" : "info"}>
                      {r.priority}
                    </StatusPill>
                    <StatusPill tone="neutral">{c.duration_minutes} min</StatusPill>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{r.reason}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Source: {r.source_module}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onOpenCourse(c.id)}>View course</Button>
                    <Button size="sm" variant="ghost" onClick={() => onAskJova(`Why was ${c.title} recommended?`, "course", c.id)}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Upcoming / Overdue */}
      <section>
        <h2 className="text-[16px] font-semibold text-foreground">Upcoming and overdue training</h2>
        <div className="mt-3 space-y-2">
          {[...overdue, ...upcoming.filter((u) => !overdue.some((o) => o.id === u.id))].length === 0 ? (
            <EmptyState title="Nothing due in the next 30 days" />
          ) : (
            [...overdue, ...upcoming.filter((u) => !overdue.some((o) => o.id === u.id))].map((a) => (
              <AssignmentRow key={a.id} a={a} onOpen={() => onOpenCourse(a.course_id)} />
            ))
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="text-[16px] font-semibold text-foreground">Recent learning activity</h2>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {recent.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-muted-foreground">No Academy activity yet.</div>
          ) : (
            recent.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 text-[13px]">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{a.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{a.description}</p>
                </div>
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {formatDate(a.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AssignmentRow({ a, onOpen }: { a: AcademyAssignment; onOpen: () => void }) {
  const course = getCourse(a.course_id);
  const overdue = isAssignmentOverdue(a);
  const dueSoon = isDueSoon(a);
  const tone: Tone = a.status === "completed" ? "success" : overdue ? "danger" : dueSoon ? "warning" : "info";
  const [openDate, setOpenDate] = useState(false);
  const [dateValue, setDateValue] = useState(a.due_date ? a.due_date.slice(0, 10) : "");
  const [openExt, setOpenExt] = useState(false);
  const [extDate, setExtDate] = useState("");
  const [extNote, setExtNote] = useState("");
  return (
    <Card className="flex flex-wrap items-center gap-3 border border-border bg-card p-3 shadow-none">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground">
          {a.learner_name} - {course?.title ?? a.course_id}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
          <StatusPill tone={tone}>{overdue ? "overdue" : a.status}</StatusPill>
          {a.due_date && (
            <span className="text-muted-foreground">Due {formatDate(a.due_date)}</span>
          )}
          {a.reason && <span className="text-muted-foreground">· {a.reason}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onOpen}>Open course</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpenDate(true)}>Reassign date</Button>
        {a.status !== "completed" && (
          <Button size="sm" variant="ghost" onClick={() => setOpenExt(true)}>Mark completed</Button>
        )}
      </div>

      <Dialog open={openDate} onOpenChange={setOpenDate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign due date</DialogTitle>
            <DialogDescription>Change the due date for {a.learner_name} - {course?.title}.</DialogDescription>
          </DialogHeader>
          <Label>New due date</Label>
          <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDate(false)}>Cancel</Button>
            <Button
              onClick={() => {
                reassignAssignmentDate(a.id, dateValue ? new Date(dateValue).toISOString() : null);
                toast.success("Due date updated");
                setOpenDate(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openExt} onOpenChange={setOpenExt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark externally completed</DialogTitle>
            <DialogDescription>
              Record completion of this training outside Academy. This does not generate a Jojan One certificate.
            </DialogDescription>
          </DialogHeader>
          <Label>Completion date</Label>
          <Input type="date" value={extDate} onChange={(e) => setExtDate(e.target.value)} />
          <Label className="mt-3">Evidence note</Label>
          <Textarea rows={3} value={extNote} onChange={(e) => setExtNote(e.target.value)} placeholder="e.g. external provider certificate ref…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenExt(false)}>Cancel</Button>
            <Button
              disabled={!extDate || !extNote.trim()}
              onClick={() => {
                markAssignmentExternallyComplete(a.id, new Date(extDate).toISOString(), extNote.trim());
                toast.success("Recorded as completed externally");
                setOpenExt(false);
              }}
            >
              Record completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// -------------------- Library Tab --------------------

function LibraryTab({ onOpenCourse, currentLearner }: { onOpenCourse: (id: string) => void; currentLearner: LearnerId }) {
  const state = useCoreData((s) => s);
  const recommendations = useMemo(() => buildRecommendations(state), [state]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [diff, setDiff] = useState("all");
  const [dur, setDur] = useState("all");
  const [status, setStatus] = useState("all");
  const [recOnly, setRecOnly] = useState(false);

  const filtered = COURSES.filter((c) => {
    if (q && !(`${c.title} ${c.short_description} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (cat !== "all" && c.category !== cat) return false;
    if (diff !== "all" && c.difficulty !== diff) return false;
    if (dur === "short" && c.duration_minutes > 20) return false;
    if (dur === "medium" && (c.duration_minutes <= 20 || c.duration_minutes > 30)) return false;
    if (dur === "long" && c.duration_minutes <= 30) return false;
    const prog = progressFor(state, currentLearner, c.id);
    const cert = certificateFor(state, currentLearner, c.id);
    const csr = cert ? "completed" : prog ? "in_progress" : "not_started";
    if (status !== "all" && csr !== status) return false;
    if (recOnly && !recommendations.some((r) => r.course_id === c.id)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 border border-border bg-card p-3 shadow-none">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_LIST.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={diff} onValueChange={setDiff}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dur} onValueChange={setDur}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Duration" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any length</SelectItem>
            <SelectItem value="short">Under 20 min</SelectItem>
            <SelectItem value="medium">20–30 min</SelectItem>
            <SelectItem value="long">30+ min</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="not_started">Not started</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-[13px]">
          <Checkbox checked={recOnly} onCheckedChange={(v) => setRecOnly(!!v)} /> Recommended only
        </label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setQ("");
            setCat("all");
            setDiff("all");
            setDur("all");
            setStatus("all");
            setRecOnly(false);
          }}
        >
          Clear
        </Button>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState title="No courses match" description="Adjust the filters or clear them to see all courses." />
          </div>
        ) : (
          filtered.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              recommendation={recommendations.find((r) => r.course_id === c.id) ?? null}
              onOpen={() => onOpenCourse(c.id)}
              learner={currentLearner}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CourseCard({
  course,
  recommendation,
  onOpen,
  learner,
}: {
  course: Course;
  recommendation: ReturnType<typeof buildRecommendations>[number] | null;
  onOpen: () => void;
  learner: LearnerId;
}) {
  const state = useCoreData((s) => s);
  const prog = progressFor(state, learner, course.id);
  const cert = certificateFor(state, learner, course.id);
  const pct = courseCompletionPct(course, prog);
  const statusLabel = cert ? "Completed" : prog ? "In progress" : "Not started";
  const statusTone: Tone = cert ? "success" : prog ? "info" : "neutral";
  return (
    <Card className="flex h-full flex-col border border-border bg-card p-4 shadow-none">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="neutral">{course.category}</StatusPill>
        <StatusPill tone="neutral">{course.difficulty}</StatusPill>
        <StatusPill tone="neutral">{course.duration_minutes} min</StatusPill>
        <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
        {recommendation && (
          <StatusPill tone={recommendation.priority === "high" ? "danger" : "warning"}>Recommended</StatusPill>
        )}
      </div>
      <p className="mt-3 text-[15px] font-semibold text-foreground">{course.title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{course.short_description}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">{course.lessons.length} lessons · {course.quiz.length} quiz questions</p>
      {recommendation && (
        <p className="mt-2 rounded-md border border-border bg-[oklch(0.98_0.003_260)] px-2 py-1.5 text-[12px] text-muted-foreground">
          Why recommended: {recommendation.reason}
        </p>
      )}
      {prog && !cert && <Progress value={pct} className="mt-3 h-1.5" />}
      <div className="mt-auto pt-4">
        <Button size="sm" onClick={onOpen}>{cert ? "View" : prog ? "Continue" : "Start"}</Button>
      </div>
    </Card>
  );
}

// -------------------- Course Drawer + Lesson --------------------

function CourseDrawer({
  courseId,
  lessonMode,
  lessonIndex,
  learnerId,
  onClose,
  onEnterLesson,
  onExitLesson,
  onChangeLessonIndex,
  onOpenQuiz,
  onAskJova,
  onAssign,
}: {
  courseId: string;
  lessonMode: boolean;
  lessonIndex: number;
  learnerId: LearnerId;
  onClose: () => void;
  onEnterLesson: (i: number) => void;
  onExitLesson: () => void;
  onChangeLessonIndex: (i: number) => void;
  onOpenQuiz: () => void;
  onAskJova: (q: string, refType?: string, refId?: string) => void;
  onAssign: () => void;
}) {
  const state = useCoreData((s) => s);
  const course = getCourse(courseId);
  const prog = progressFor(state, learnerId, courseId);
  const cert = certificateFor(state, learnerId, courseId);
  if (!course) return null;

  const nextIdx = findNextIncompleteLessonIndex(course, prog);
  const allLessonsDone = prog ? course.lessons.every((l) => prog.lessons_completed.includes(l.id)) : false;

  const handleStart = () => {
    if (!prog) startCourse(learnerId, courseId);
    onEnterLesson(nextIdx);
  };

  const currentLesson = course.lessons[lessonIndex] ?? course.lessons[0];
  const currentDone = prog?.lessons_completed.includes(currentLesson.id) ?? false;

  return (
    <DetailDrawer
      open
      onOpenChange={(v) => !v && onClose()}
      title={lessonMode ? `${course.title} · Lesson ${lessonIndex + 1}` : course.title}
      description={lessonMode ? currentLesson.title : course.category}
    >
      {!lessonMode && (
        <div className="space-y-5">
          <p className="text-[13px] text-muted-foreground">{course.short_description}</p>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Objectives</p>
            <ul className="mt-1 list-disc pl-5 text-[13px] text-foreground">
              {course.objectives.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="text-muted-foreground">Audience</p>
              <p className="mt-0.5 text-foreground">{course.audience}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="mt-0.5 text-foreground">{course.duration_minutes} min</p>
            </div>
            <div>
              <p className="text-muted-foreground">Lessons</p>
              <p className="mt-0.5 text-foreground">{course.lessons.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Difficulty</p>
              <p className="mt-0.5 text-foreground">{course.difficulty}</p>
            </div>
          </div>
          {prog && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progress</p>
              <Progress value={courseCompletionPct(course, prog)} className="mt-1 h-1.5" />
              <p className="mt-1 text-[12px] text-muted-foreground">
                {prog.lessons_completed.length}/{course.lessons.length} lessons complete
                {cert ? ` · certificate ${cert.reference}` : ""}
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lessons</p>
            <ol className="mt-2 space-y-1">
              {course.lessons.map((l, i) => {
                const done = prog?.lessons_completed.includes(l.id);
                return (
                  <li key={l.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
                    <div className="flex items-center gap-2">
                      {done ? <CheckCircle2 className="h-4 w-4 text-[oklch(0.55_0.15_148)]" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
                      <span>{i + 1}. {l.title}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onEnterLesson(i)}>{done ? "Review" : "Open"}</Button>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="rounded-md border border-border bg-[oklch(0.98_0.003_260)] p-3 text-[12px] text-muted-foreground">
            This course is not an accredited qualification. Completing it does not by itself demonstrate legal or regulatory compliance.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleStart}>
              <Play className="mr-1.5 h-3.5 w-3.5" /> {prog ? (allLessonsDone && !cert ? "Take quiz" : "Continue") : "Start"}
            </Button>
            {allLessonsDone && !cert && (
              <Button size="sm" variant="outline" onClick={onOpenQuiz}>Take quiz</Button>
            )}
            <Button size="sm" variant="outline" onClick={onAssign}>Assign to people</Button>
            <Button size="sm" variant="ghost" onClick={() => onAskJova(`Explain the course "${course.title}".`, "course", course.id)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
            </Button>
            {course.resource && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  printCourseResource(course, state.business.name, {
                    logoDataUrl: state.app_settings?.branding?.logo_data_url ?? null,
                    displayName: state.app_settings?.branding?.display_name || state.business.name,
                  })
                }
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print resource
              </Button>
            )}
          </div>
        </div>
      )}

      {lessonMode && (
        <LessonPanel
          course={course}
          lessonIndex={lessonIndex}
          learnerId={learnerId}
          alreadyCompleted={currentDone}
          onExit={onExitLesson}
          onPrev={() => onChangeLessonIndex(lessonIndex - 1)}
          onNext={() => onChangeLessonIndex(lessonIndex + 1)}
          onTakeQuiz={onOpenQuiz}
          onAskJova={onAskJova}
          onPrintResource={() =>
            printCourseResource(course, state.business.name, {
              logoDataUrl: state.app_settings?.branding?.logo_data_url ?? null,
              displayName: state.app_settings?.branding?.display_name || state.business.name,
            })
          }
        />
      )}
    </DetailDrawer>
  );
}

// -------------------- Quiz --------------------
// -------------------- Assign Dialog --------------------

function AssignDialog({
  initialCourseId,
  learners,
  onClose,
}: {
  initialCourseId: string | null;
  learners: ReturnType<typeof listLearners>;
  onClose: () => void;
}) {
  const [courseId, setCourseId] = useState<string>(initialCourseId ?? COURSES[0].id);
  const [selected, setSelected] = useState<Set<LearnerId>>(new Set());
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");

  const toggle = (id: LearnerId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign training</DialogTitle>
          <DialogDescription>Select the course and the people to assign it to.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COURSES.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assign to</Label>
            <div className="mt-1 max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {learners.map((l) => (
                <label key={l.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                  <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <span className="flex-1">{l.name}</span>
                  <span className="text-muted-foreground">{l.role}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual refresher" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => {
              const count = assignCourses(
                Array.from(selected),
                courseId,
                due ? new Date(due).toISOString() : null,
                reason.trim(),
              );
              if (count > 0) toast.success(`Assigned to ${count} learner${count === 1 ? "" : "s"}`);
              else toast.info("No new assignments created (duplicates skipped)");
              onClose();
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- My Learning Tab --------------------

function MyLearningTab({ currentLearner, onOpenCourse }: { currentLearner: LearnerId; onOpenCourse: (id: string) => void }) {
  const state = useCoreData((s) => s);
  const [filter, setFilter] = useState("all");
  const assignments = state.academy_assignments.filter((a) => a.learner_id === currentLearner);
  const progress = state.academy_progress.filter((p) => p.learner_id === currentLearner);
  const certs = state.academy_certificates.filter((c) => c.learner_id === currentLearner);
  const attempts = state.academy_quiz_attempts.filter((a) => a.learner_id === currentLearner);
  const totalMinutes = progress.reduce((s, p) => s + p.time_minutes, 0);

  const learnerCourses = Array.from(new Set([...assignments.map((a) => a.course_id), ...progress.map((p) => p.course_id)]));
  const items = learnerCourses
    .map((cid) => {
      const c = getCourse(cid);
      if (!c) return null;
      const p = progressFor(state, currentLearner, cid);
      const cert = certificateFor(state, currentLearner, cid);
      const a = assignments.find((x) => x.course_id === cid);
      const state0 = cert ? "completed" : p ? "in_progress" : "assigned";
      const overdue = a ? isAssignmentOverdue(a) : false;
      return { course: c, progress: p, cert, assignment: a, state0, overdue };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .filter((x) => {
      if (filter === "all") return true;
      if (filter === "overdue") return x.overdue;
      if (filter === "completed") return x.state0 === "completed";
      if (filter === "in_progress") return x.state0 === "in_progress";
      if (filter === "assigned") return x.state0 === "assigned";
      return true;
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Assigned" value={assignments.length} />
        <MetricCard label="Completed" value={assignments.filter((a) => a.status === "completed").length + certs.length - assignments.filter((a) => a.status === "completed" && certs.some((c) => c.course_id === a.course_id)).length} />
        <MetricCard label="Certificates" value={certs.length} icon={Award} />
        <MetricCard label="Total learning time" value={`${(totalMinutes / 60).toFixed(1)}h`} icon={Clock} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No learning yet" description="Assign yourself a course from the library." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const pct = courseCompletionPct(it.course, it.progress);
            const tone: Tone = it.cert ? "success" : it.overdue ? "danger" : it.progress ? "info" : "neutral";
            return (
              <Card key={it.course.id} className="border border-border bg-card p-4 shadow-none">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold text-foreground">{it.course.title}</p>
                  <StatusPill tone={tone}>{it.cert ? "Completed" : it.overdue ? "Overdue" : it.progress ? "In progress" : "Assigned"}</StatusPill>
                </div>
                {it.progress && !it.cert && <Progress value={pct} className="mt-2 h-1.5" />}
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {it.assignment?.due_date && `Due ${formatDate(it.assignment.due_date)} · `}
                  {it.cert ? `Certificate ${it.cert.reference}` : it.progress ? `${it.progress.lessons_completed.length}/${it.course.lessons.length} lessons` : "Not started"}
                </p>
                <Button size="sm" className="mt-3" onClick={() => onOpenCourse(it.course.id)}>Open</Button>
              </Card>
            );
          })}
        </div>
      )}

      {attempts.length > 0 && (
        <div>
          <h3 className="mt-4 text-[14px] font-semibold text-foreground">Quiz results</h3>
          <div className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 text-[13px]">
                <div>
                  <p className="font-medium text-foreground">{getCourse(a.course_id)?.title ?? a.course_id}</p>
                  <p className="text-[12px] text-muted-foreground">{formatDate(a.taken_at)}</p>
                </div>
                <StatusPill tone={a.passed ? "success" : "warning"}>{a.score}% · {a.passed ? "Passed" : "Failed"}</StatusPill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- Team Training Tab --------------------

function TeamTrainingTab({
  onOpenCourse,
  onAssign,
  onAskJova,
}: {
  onOpenCourse: (id: string, learner?: LearnerId) => void;
  onAssign: (courseId?: string) => void;
  onAskJova: (q: string, refType?: string, refId?: string) => void;
}) {
  const state = useCoreData((s) => s);
  const learners = listLearners(state);
  const [view, setView] = useState<"people" | "course">("people");
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={view} onValueChange={(v) => setView(v as "people" | "course")}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="people">People view</SelectItem>
            <SelectItem value="course">Course view</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => onAssign()}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Assign training
        </Button>
      </div>

      {view === "people" && (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {learners.map((l) => {
            const rows = state.academy_assignments.filter((a) => a.learner_id === l.id);
            const overdue = rows.filter(isAssignmentOverdue).length;
            const completed = rows.filter((a) => a.status === "completed").length;
            const totalLessons = rows.reduce((s, a) => s + (getCourse(a.course_id)?.lessons.length ?? 0), 0);
            const doneLessons = rows.reduce((s, a) => {
              const p = progressFor(state, l.id, a.course_id);
              return s + (p ? p.lessons_completed.length : 0);
            }, 0);
            const pct = totalLessons === 0 ? 0 : Math.round((doneLessons / totalLessons) * 100);
            const nextDue = rows
              .filter((a) => a.status !== "completed" && a.due_date)
              .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];
            return (
              <div key={l.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">{l.name}</p>
                    <p className="text-[12px] text-muted-foreground">{l.role} · {l.employment_type}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {l.employee && (
                      <Button size="sm" variant="outline" onClick={() => navigate({ to: "/hr", search: { e: l.id } })}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open in HR
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onAskJova(`What training gaps does ${l.name} have?`, "employee", l.id !== "owner" ? l.id : undefined)}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Jova
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                  <StatusPill tone={overdue > 0 ? "danger" : "info"}>{rows.length} assignments</StatusPill>
                  <StatusPill tone="success">{completed} completed</StatusPill>
                  <StatusPill tone={overdue > 0 ? "danger" : "neutral"}>{overdue} overdue</StatusPill>
                  {nextDue && nextDue.due_date && (
                    <span className="text-muted-foreground">Next due {formatDate(nextDue.due_date)}</span>
                  )}
                </div>
                {rows.length > 0 && (
                  <div className="mt-2">
                    <Progress value={pct} className="h-1.5" />
                    <div className="mt-2 space-y-1">
                      {rows.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                          <span className="flex-1 text-foreground">{getCourse(a.course_id)?.title ?? a.course_id}</span>
                          <StatusPill tone={a.status === "completed" ? "success" : isAssignmentOverdue(a) ? "danger" : "warning"}>
                            {isAssignmentOverdue(a) ? "overdue" : a.status}
                          </StatusPill>
                          {a.due_date && <span className="text-muted-foreground">Due {formatDate(a.due_date)}</span>}
                          <Button size="sm" variant="ghost" onClick={() => onOpenCourse(a.course_id, l.id)}>Open</Button>
                          <AssignmentRowActions a={a} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "course" && (
        <div className="grid gap-3 md:grid-cols-2">
          {COURSES.filter((c) => state.academy_assignments.some((a) => a.course_id === c.id)).map((c) => {
            const rows = state.academy_assignments.filter((a) => a.course_id === c.id);
            const completed = rows.filter((a) => a.status === "completed").length;
            const overdue = rows.filter(isAssignmentOverdue).length;
            return (
              <Card key={c.id} className="border border-border bg-card p-4 shadow-none">
                <p className="text-[14px] font-semibold text-foreground">{c.title}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                  <StatusPill tone="info">{rows.length} learners</StatusPill>
                  <StatusPill tone="success">{completed} completed</StatusPill>
                  <StatusPill tone={overdue > 0 ? "danger" : "neutral"}>{overdue} overdue</StatusPill>
                </div>
                <div className="mt-2 space-y-1 text-[12px]">
                  {rows.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <span className="flex-1">{a.learner_name}</span>
                      <StatusPill tone={a.status === "completed" ? "success" : isAssignmentOverdue(a) ? "danger" : "warning"}>
                        {isAssignmentOverdue(a) ? "overdue" : a.status}
                      </StatusPill>
                      {a.due_date && <span className="text-muted-foreground">{formatDate(a.due_date)}</span>}
                    </div>
                  ))}
                </div>
                <Button size="sm" className="mt-3" variant="outline" onClick={() => onAssign(c.id)}>Assign to more people</Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignmentRowActions({ a }: { a: AcademyAssignment }) {
  const [openDate, setOpenDate] = useState(false);
  const [dateValue, setDateValue] = useState(a.due_date ? a.due_date.slice(0, 10) : "");
  const [openExt, setOpenExt] = useState(false);
  const [extDate, setExtDate] = useState("");
  const [extNote, setExtNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpenDate(true)}>Date</Button>
      {a.status !== "completed" && (
        <Button size="sm" variant="ghost" onClick={() => setOpenExt(true)}>Complete</Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete assignment">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={openDate} onOpenChange={setOpenDate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign due date</DialogTitle>
          </DialogHeader>
          <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDate(false)}>Cancel</Button>
            <Button onClick={() => { reassignAssignmentDate(a.id, dateValue ? new Date(dateValue).toISOString() : null); toast.success("Due date updated"); setOpenDate(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openExt} onOpenChange={setOpenExt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark externally completed</DialogTitle>
            <DialogDescription>Requires a completion date and evidence note.</DialogDescription>
          </DialogHeader>
          <Label>Completion date</Label>
          <Input type="date" value={extDate} onChange={(e) => setExtDate(e.target.value)} />
          <Label className="mt-3">Evidence note</Label>
          <Textarea rows={3} value={extNote} onChange={(e) => setExtNote(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenExt(false)}>Cancel</Button>
            <Button
              disabled={!extDate || !extNote.trim()}
              onClick={() => {
                markAssignmentExternallyComplete(a.id, new Date(extDate).toISOString(), extNote.trim());
                toast.success("Recorded");
                setOpenExt(false);
              }}
            >
              Record completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this assignment?"
        description="This does not delete completion history or certificates."
        destructive
        confirmLabel="Delete"
        onConfirm={() => {
          deleteAssignment(a.id);
          toast.success("Assignment deleted");
          setConfirmDelete(false);
        }}
      />
    </>
  );
}

// -------------------- Certificates Tab --------------------

function CertificatesTab({ activeId }: { activeId?: string }) {
  const state = useCoreData((s) => s);
  const [selected, setSelected] = useState<string | null>(activeId ?? null);
  const cert = selected ? state.academy_certificates.find((c) => c.id === selected) : null;
  const certOpts = {
    includeLogo: state.app_settings?.certificate_defaults?.include_logo ?? true,
    logoDataUrl: state.app_settings?.branding?.logo_data_url ?? null,
    displayName: state.app_settings?.branding?.display_name || state.business.name,
  };

  return (
    <div className="space-y-4">
      {state.academy_certificates.length === 0 ? (
        <EmptyState icon={Award} title="No certificates yet" description="Complete a course and its quiz to earn one." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.academy_certificates.map((c) => (
            <Card key={c.id} className="border border-border bg-card p-4 shadow-none">
              <div className="flex flex-wrap items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <p className="text-[14px] font-semibold text-foreground">{c.course_title}</p>
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {c.learner_name} · {formatDate(c.completed_at)} · quiz {c.quiz_score}%
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{c.reference}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setSelected(c.id)}>View</Button>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.reference); toast.success("Reference copied"); }}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy reference
                </Button>
                <Button size="sm" variant="outline" onClick={() => printCertificate(c, state.business.name, certOpts)}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {cert && (
        <Dialog open onOpenChange={(v) => !v && setSelected(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Certificate - {cert.course_title}</DialogTitle>
              <DialogDescription>{cert.reference}</DialogDescription>
            </DialogHeader>
            <CertificateBody cert={cert} businessName={state.business.name} />
            <DialogFooter>
              <Button variant="outline" onClick={() => printCertificate(cert, state.business.name, certOpts)}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
              </Button>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CertificateBody({ cert, businessName }: { cert: import("@/data/types").AcademyCertificate; businessName: string }) {
  return (
    <div className="rounded-md border-[3px] border-[oklch(0.35_0.12_264)] bg-[oklch(0.995_0.003_260)] p-8">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[oklch(0.35_0.12_264)]">
          Jojan One Academy
        </p>
        <p className="mt-1 text-[12px] italic text-muted-foreground">Completion record</p>
        <div className="mx-auto mt-3 h-px w-24 bg-[oklch(0.35_0.12_264)]/40" />
        <p className="mt-6 text-[12px] uppercase tracking-widest text-muted-foreground">Awarded to</p>
        <h3 className="mt-1 text-[26px] font-semibold text-foreground">{cert.learner_name}</h3>
        <p className="mt-4 text-[12px] uppercase tracking-widest text-muted-foreground">for completing</p>
        <p className="mt-1 text-[17px] font-medium text-foreground">{cert.course_title}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">at {businessName}</p>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-3 border-y border-border py-3 text-center text-[12px]">
        <div>
          <p className="text-muted-foreground">Completed</p>
          <p className="mt-0.5 font-medium text-foreground">{formatDate(cert.completed_at)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Quiz score</p>
          <p className="mt-0.5 font-medium text-foreground">{cert.quiz_score}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">Duration</p>
          <p className="mt-0.5 font-medium text-foreground">{cert.duration_minutes} min</p>
        </div>
        <div>
          <p className="text-muted-foreground">Reference</p>
          <p className="mt-0.5 font-mono text-[11px] font-medium text-foreground">{cert.reference}</p>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">Issued by Jojan One Academy</p>
      <p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
        {CERTIFICATE_STATEMENT}
      </p>
    </div>
  );
}

function printCertificate(
  cert: import("@/data/types").AcademyCertificate,
  businessName: string,
  opts?: { includeLogo?: boolean; logoDataUrl?: string | null; displayName?: string },
) {
  const includeLogo = opts?.includeLogo ?? true;
  const logoDataUrl = opts?.logoDataUrl ?? null;
  const displayName = opts?.displayName || businessName;
  const completedLong = new Date(cert.completed_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const style = `
    @page { size: A4 portrait; margin: 18mm; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #1B2A4A; }
    body { font-family: Inter, system-ui, -apple-system, sans-serif; }
    .sheet { box-sizing: border-box; width: 100%; min-height: calc(297mm - 36mm); padding: 22mm 18mm; border: 4px solid #1E3A8A; border-radius: 4px; display: flex; flex-direction: column; justify-content: space-between; }
    .logo-wrap { text-align: center; margin-bottom: 12px; }
    .logo-wrap img { max-height: 48px; max-width: 180px; object-fit: contain; display: inline-block; }
    .logo-fallback { display: inline-grid; place-items: center; height: 40px; width: 40px; background: #1E3A8A; border-radius: 8px; color: #ffffff; font-weight: 700; font-size: 14px; letter-spacing: .05em; }
    .eyebrow { font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #1E3A8A; font-weight: 700; text-align: center; }
    .subtle { font-size: 12px; color: #6B7280; text-align: center; font-style: italic; margin-top: 4px; }
    .rule { height: 1px; background: #1E3A8A; opacity: .35; width: 96px; margin: 18px auto; }
    .caption { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #6B7280; text-align: center; margin-top: 24px; }
    .name { font-size: 40px; font-weight: 600; text-align: center; margin: 8px 0 0 0; color: #0F172A; letter-spacing: -0.01em; }
    .course { font-size: 20px; text-align: center; margin: 6px 0 0 0; color: #1B2A4A; font-weight: 500; }
    .business { font-size: 12px; text-align: center; color: #6B7280; margin-top: 4px; }
    .facts { margin-top: 28px; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 14px 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; font-size: 12px; }
    .facts .label { color: #6B7280; }
    .facts .val { font-weight: 600; margin-top: 2px; color: #0F172A; }
    .facts .ref { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; }
    .footer { margin-top: 24px; font-size: 11px; color: #6B7280; text-align: center; }
    .statement { margin-top: 14px; font-size: 10px; line-height: 1.55; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 10px; }
  `;
  const html = `
    <div class="sheet">
      <div>
        ${includeLogo ? `<div class="logo-wrap">${logoDataUrl ? `<img src="${escapeHtml(logoDataUrl)}" alt="${escapeHtml(displayName)} logo" onerror="this.outerHTML='<span class=\\'logo-fallback\\'>J1</span>'"/>` : `<span class="logo-fallback">J1</span>`}</div>` : ""}
        <p class="eyebrow">Jojan One Academy</p>
        <p class="subtle">Completion record</p>
        <div class="rule"></div>
        <p class="caption">Awarded to</p>
        <p class="name">${escapeHtml(cert.learner_name)}</p>
        <p class="caption">for completing</p>
        <p class="course">${escapeHtml(cert.course_title)}</p>
        <p class="business">at ${escapeHtml(businessName)}</p>
        <div class="facts">
          <div><div class="label">Completed</div><div class="val">${escapeHtml(completedLong)}</div></div>
          <div><div class="label">Quiz score</div><div class="val">${cert.quiz_score}%</div></div>
          <div><div class="label">Learning duration</div><div class="val">${cert.duration_minutes} min</div></div>
          <div><div class="label">Reference</div><div class="val ref">${escapeHtml(cert.reference)}</div></div>
        </div>
      </div>
      <div>
        <p class="footer">Issued by Jojan One Academy</p>
        <p class="statement">${escapeHtml(CERTIFICATE_STATEMENT)}</p>
      </div>
    </div>`;
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(cert.course_title)} - Certificate ${escapeHtml(cert.reference)}</title><style>${style}</style></head><body>${html}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}