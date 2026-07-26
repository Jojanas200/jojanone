"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
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
import { NewPolicy } from "./NewPolicy";
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
}: {
  policies: PolicyRow[];
  canWrite: boolean;
}) {
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

      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">
            Register{policies.length ? ` (${policies.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="library">
            Template library ({POLICY_TEMPLATES.length})
          </TabsTrigger>
        </TabsList>

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
                    {t.requiresAcknowledgement && (
                      <Badge variant="outline" className="shrink-0">
                        sign-off
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.description}
                  </p>
                  {canWrite && (
                    <div className="mt-auto pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDraft(t.key)}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Draft with Jova
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
