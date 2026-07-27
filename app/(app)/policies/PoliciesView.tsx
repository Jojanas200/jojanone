"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Search, Sparkles } from "lucide-react";
import { POLICY_TEMPLATES } from "@/shared/policies/templates";
import { POLICY_CATEGORIES } from "@/shared/schemas/policies";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pager } from "../_shared/board-bits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComposeProfile } from "@/shared/policies/compose";
import { NewPolicy } from "./NewPolicy";
import { TemplatePreview } from "./TemplatePreview";
import { DraftWithJova } from "./DraftWithJova";
import { RowActions } from "./RowActions";

export type PolicyRow = {
  id: string;
  policyName: string;
  policyCategory: string | null;
  version: string;
  owner: string | null;
  status: string;
  acknowledgementRequired: boolean;
  acknowledgementStatus: string;
  reviewDate: string | null;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const statusVariant: Record<
  string,
  "outline" | "secondary" | "destructive" | "success" | "warning"
> = {
  draft: "outline",
  active: "success",
  archived: "outline",
};

const ackLabel: Record<string, string> = {
  not_started: "Not started",
  partial: "Partial",
  complete: "Complete",
};

const isOverdue = (d: string | null) =>
  !!d && new Date(d).getTime() < Date.now();

const TEMPLATE_CATEGORIES = Array.from(
  new Set(POLICY_TEMPLATES.map((t) => t.category)),
).sort();

export function PoliciesView({
  policies,
  canWrite,
  profile,
}: {
  policies: PolicyRow[];
  canWrite: boolean;
  profile: ComposeProfile;
}) {
  // Controlled tabs so Overview shortcuts can jump into the library.
  const [tab, setTab] = useState("overview");

  // Register filters
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [categoryF, setCategoryF] = useState("all");

  // Template library filters
  const [libQuery, setLibQuery] = useState("");
  const [libCat, setLibCat] = useState("all");

  // Controlled "Draft with Jova" dialog (also launched from the library).
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState<string | null>(null);
  function openDraft(templateKey: string | null) {
    setDraftTemplate(templateKey);
    setDraftOpen(true);
  }

  // Template preview dialog.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const previewTemplate =
    POLICY_TEMPLATES.find((t) => t.key === previewKey) ?? null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return policies.filter((p) => {
      if (statusF !== "all" && p.status !== statusF) return false;
      if (categoryF !== "all" && p.policyCategory !== categoryF) return false;
      if (
        q &&
        !p.policyName.toLowerCase().includes(q) &&
        !(p.policyCategory ?? "").toLowerCase().includes(q) &&
        !(p.owner ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [policies, query, statusF, categoryF]);

  const libShown = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    return POLICY_TEMPLATES.filter((t) => {
      if (libCat !== "all" && t.category !== libCat) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.audience.toLowerCase().includes(q)
      );
    });
  }, [libQuery, libCat]);

  const registerFiltersActive =
    !!query || statusF !== "all" || categoryF !== "all";

  // Overview: what needs attention now + standard policies not yet on the
  // register (mirrors the prototype's Overview tab).
  const today = new Date().toISOString().slice(0, 10);
  const overdue = policies.filter(
    (p) => p.status !== "archived" && p.reviewDate && p.reviewDate < today,
  );
  const drafts = policies.filter((p) => p.status === "draft");
  const attention = [
    ...overdue.map((p) => ({ p, why: "Review overdue" })),
    ...drafts
      .filter((d) => !overdue.some((o) => o.id === d.id))
      .map((p) => ({ p, why: "Draft - not yet active" })),
  ].slice(0, 8);
  const registerNames = new Set(
    policies.map((p) => p.policyName.toLowerCase()),
  );
  const missing = POLICY_TEMPLATES.filter(
    (t) => !registerNames.has(t.title.toLowerCase()),
  );

  // Review schedule: active policies ordered by next review date.
  const scheduled = policies
    .filter((p) => p.status === "active")
    .sort((a, b) =>
      (a.reviewDate ?? "9999").localeCompare(b.reviewDate ?? "9999"),
    );
  const daysUntil = (d: string | null) =>
    d ? Math.ceil((new Date(d).getTime() - Date.now()) / 864e5) : null;

  // Client-side pagination keeps the register readable as records grow.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const paged = shown.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      {canWrite && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => openDraft(null)}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            Draft with Jova
          </Button>
          <NewPolicy />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="library">
            Template library ({POLICY_TEMPLATES.length})
          </TabsTrigger>
          <TabsTrigger value="register">
            Register{policies.length ? ` (${policies.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="schedule">Review schedule</TabsTrigger>
        </TabsList>

        {/* --- Overview ------------------------------------------------------ */}
        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Attention now
              </h3>
              <p className="text-xs text-muted-foreground">
                Reviews overdue and drafts not yet in force.
              </p>
              {attention.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing needs attention - all policies are current.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {attention.map(({ p, why }) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/policies/${p.id}`}
                          className="block truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {p.policyName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.policyCategory ?? "Uncategorised"} · v{p.version}
                        </p>
                      </div>
                      <Badge
                        variant={
                          why === "Review overdue" ? "destructive" : "warning"
                        }
                        className="shrink-0"
                      >
                        {why}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Missing standard policies
              </h3>
              <p className="text-xs text-muted-foreground">
                Common documents most UK businesses maintain. Start one when it
                applies to you.
              </p>
              {missing.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  All standard policies are present on your register.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {missing.slice(0, 10).map((t) => (
                    <li
                      key={t.key}
                      className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.category}
                        </p>
                      </div>
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDraft(t.key)}
                        >
                          Start
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Template library
            </h3>
            <p className="text-xs text-muted-foreground">
              {POLICY_TEMPLATES.length} guided templates across policies,
              notices, procedures, contracts and handbooks.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMPLATE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setLibCat(c);
                    setTab("library");
                  }}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition hover:bg-muted"
                >
                  {c} ·{" "}
                  {POLICY_TEMPLATES.filter((t) => t.category === c).length}
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* --- Register ------------------------------------------------------ */}
        <TabsContent value="register" className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, category or owner…"
                className="pl-8"
              />
            </div>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-[160px] capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {["draft", "active", "archived"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryF} onValueChange={setCategoryF}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {POLICY_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {registerFiltersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatusF("all");
                  setCategoryF("all");
                }}
              >
                Clear
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {shown.length} of {policies.length}
            </span>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sign-off</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No policies yet. Add your first one, or start from the
                        template library.
                      </TableCell>
                    </TableRow>
                  ) : shown.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No policies match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/policies/${p.id}`}
                            className="text-foreground hover:underline"
                          >
                            {p.policyName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.policyCategory ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.version}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.owner ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[p.status] ?? "outline"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.acknowledgementRequired
                            ? (ackLabel[p.acknowledgementStatus] ??
                              p.acknowledgementStatus)
                            : "Not required"}
                        </TableCell>
                        <TableCell
                          className={
                            p.status !== "archived" && isOverdue(p.reviewDate)
                              ? "font-medium text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {fmtDate(p.reviewDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canWrite && (
                            <RowActions id={p.id} status={p.status} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Pager
            page={cur}
            pageCount={pageCount}
            total={shown.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </TabsContent>

        {/* --- Template library --------------------------------------------- */}
        <TabsContent value="library" className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={libQuery}
                onChange={(e) => setLibQuery(e.target.value)}
                placeholder="Search templates…"
                className="pl-8"
              />
            </div>
            <Select value={libCat} onValueChange={setLibCat}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {libShown.length} of {POLICY_TEMPLATES.length}
            </span>
          </div>

          {libShown.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No templates match your search.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {libShown.map((t) => (
                <Card key={t.key} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.category} · {t.audience}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {(t.kind ?? "policy") !== "policy" && (
                        <Badge variant="secondary" className="capitalize">
                          {t.kind}
                        </Badge>
                      )}
                      {t.requiresAcknowledgement && (
                        <Badge variant="outline">sign-off</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.description}
                  </p>
                  <div className="mt-auto flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewKey(t.key)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Preview
                    </Button>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDraft(t.key)}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Draft with Jova
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Review schedule ----------------------------------------------- */}
        <TabsContent value="schedule" className="mt-6">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Review schedule
            </h3>
            <p className="text-xs text-muted-foreground">
              Active policies ordered by next review date.
            </p>
            {scheduled.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No active policies yet. Activate a policy and its review date
                will appear here.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {scheduled.map((p) => {
                  const days = daysUntil(p.reviewDate);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/policies/${p.id}`}
                          className="block truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {p.policyName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Review {fmtDate(p.reviewDate)} · Owner{" "}
                          {p.owner ?? "-"} · v{p.version}
                        </p>
                      </div>
                      {days === null ? (
                        <Badge variant="outline" className="shrink-0">
                          No date set
                        </Badge>
                      ) : (
                        <Badge
                          variant={
                            days < 0
                              ? "destructive"
                              : days <= 30
                                ? "warning"
                                : "success"
                          }
                          className="shrink-0"
                        >
                          {days < 0 ? `${-days}d overdue` : `${days}d`}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          profile={profile}
          canWrite={canWrite}
          onClose={() => setPreviewKey(null)}
          onUse={() => {
            setPreviewKey(null);
            openDraft(previewTemplate.key);
          }}
        />
      )}

      {canWrite && (
        <DraftWithJova
          open={draftOpen}
          onOpenChange={setDraftOpen}
          initialTemplateKey={draftTemplate}
          showTrigger={false}
        />
      )}
    </>
  );
}
