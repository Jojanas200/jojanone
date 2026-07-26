"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AreaField,
  Block,
  Field,
  FilterIcon,
  FilterSelect,
  SearchInput,
  SelectField,
  StatTiles,
  SwitchField,
  TextField,
} from "../_shared/board-bits";
import { fmtDate, nice } from "../_shared/format";
import type { listProcessingActivities } from "@/server/services/gdpr";

type Activity = Awaited<ReturnType<typeof listProcessingActivities>>[number];

const LAWFUL = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
];
const STATUSES = ["active", "archived"];

const within30 = (d: string | null) => {
  if (!d) return false;
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  return days <= 30;
};

export function GdprBoard({
  activities,
  canWrite,
}: {
  activities: Activity[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [basisF, setBasisF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [active, setActive] = useState<Activity | null>(null);

  const tiles = useMemo(
    () => [
      { label: "Activities", value: String(activities.length) },
      {
        label: "Special category",
        value: String(activities.filter((a) => a.specialCategoryData).length),
      },
      {
        label: "Intl transfers",
        value: String(
          activities.filter((a) => a.internationalTransfers).length,
        ),
      },
      {
        label: "Reviews due",
        value: String(
          activities.filter(
            (a) => a.status === "active" && within30(a.reviewDate),
          ).length,
        ),
      },
      {
        label: "Archived",
        value: String(activities.filter((a) => a.status === "archived").length),
      },
    ],
    [activities],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (basisF !== "all" && a.lawfulBasis !== basisF) return false;
      if (statusF !== "all" && a.status !== statusF) return false;
      if (
        q &&
        !a.activityName.toLowerCase().includes(q) &&
        !(a.dataSubjects ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [activities, search, basisF, statusF]);

  const filtersActive = !!search || basisF !== "all" || statusF !== "all";

  return (
    <>
      <StatTiles tiles={tiles} />

      <div className="mb-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by activity or data subjects…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterIcon />
          <FilterSelect
            value={basisF}
            onChange={setBasisF}
            allLabel="Any lawful basis"
            options={LAWFUL}
          />
          <FilterSelect
            value={statusF}
            onChange={setStatusF}
            allLabel="Any status"
            options={STATUSES}
          />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setBasisF("all");
                setStatusF("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {activities.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No processing activities yet. Map how you use personal data to build
            your ROPA.
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No activities match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Data subjects</TableHead>
                  <TableHead>Lawful basis</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => (
                  <TableRow
                    key={a.id}
                    onClick={() => setActive(a)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      {a.activityName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.dataSubjects || "-"}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {a.lawfulBasis ? nice(a.lawfulBasis) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.retentionPeriod || "-"}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {a.specialCategoryData && (
                        <Badge variant="destructive">special category</Badge>
                      )}
                      {a.internationalTransfers && (
                        <Badge variant="secondary">intl transfer</Badge>
                      )}
                      {!a.specialCategoryData && !a.internationalTransfers && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          a.status === "active" ? "outline" : "secondary"
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ActivityDrawer
        activity={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function ActivityDrawer({
  activity,
  canWrite,
  onClose,
}: {
  activity: Activity | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const close = () => {
    setEditing(false);
    onClose();
  };
  return (
    <Sheet open={!!activity} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {activity &&
          (editing ? (
            <ActivityEditForm
              activity={activity}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ActivityView
              activity={activity}
              canWrite={canWrite}
              onEdit={() => setEditing(true)}
              onChanged={() => router.refresh()}
              onClosed={close}
            />
          ))}
      </SheetContent>
    </Sheet>
  );
}

function ActivityView({
  activity: a,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  activity: Activity;
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(status === "archived" ? "Archived" : "Reactivated");
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch("/api/gdpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityName: `${a.activityName} (copy)`,
          businessPurpose: a.businessPurpose,
          dataSubjects: a.dataSubjects,
          personalDataCategories: a.personalDataCategories,
          specialCategoryData: a.specialCategoryData,
          lawfulBasis: a.lawfulBasis,
          recipients: a.recipients,
          processors: a.processors,
          internationalTransfers: a.internationalTransfers,
          retentionPeriod: a.retentionPeriod,
          securityMeasures: a.securityMeasures,
          owner: a.owner,
          reviewDate: a.reviewDate,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Activity duplicated");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${a.activityName}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Activity deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{a.activityName}</SheetTitle>
        <SheetDescription className="capitalize">
          {a.lawfulBasis ? nice(a.lawfulBasis) : "No lawful basis set"} ·{" "}
          {a.status}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Data subjects">{a.dataSubjects || "-"}</Field>
          <Field label="Retention">{a.retentionPeriod || "-"}</Field>
          <Field label="Owner">{a.owner || "-"}</Field>
          <Field label="Review date">{fmtDate(a.reviewDate)}</Field>
          <Field label="Special category">
            {a.specialCategoryData ? "Yes" : "No"}
          </Field>
          <Field label="International transfers">
            {a.internationalTransfers ? "Yes" : "No"}
          </Field>
        </dl>
        {a.businessPurpose && (
          <Block label="Business purpose" body={a.businessPurpose} />
        )}
        {a.personalDataCategories && (
          <Block label="Data categories" body={a.personalDataCategories} />
        )}
        {a.recipients && <Block label="Recipients" body={a.recipients} />}
        {a.processors && <Block label="Processors" body={a.processors} />}
        {a.securityMeasures && (
          <Block label="Security measures" body={a.securityMeasures} />
        )}

        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            {a.status === "active" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("archived")}
                disabled={busy}
              >
                Archive
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("active")}
                disabled={busy}
              >
                Reactivate
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={duplicate}
              disabled={busy}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={remove}
              disabled={busy}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ActivityEditForm({
  activity: a,
  onDone,
  onCancel,
}: {
  activity: Activity;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    activityName: a.activityName,
    businessPurpose: a.businessPurpose ?? "",
    dataSubjects: a.dataSubjects ?? "",
    personalDataCategories: a.personalDataCategories ?? "",
    lawfulBasis: a.lawfulBasis ?? "unset",
    recipients: a.recipients ?? "",
    processors: a.processors ?? "",
    retentionPeriod: a.retentionPeriod ?? "",
    securityMeasures: a.securityMeasures ?? "",
    owner: a.owner ?? "",
    reviewDate: a.reviewDate ?? "",
    specialCategoryData: a.specialCategoryData,
    internationalTransfers: a.internationalTransfers,
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/gdpr/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityName: f.activityName,
          businessPurpose: f.businessPurpose || null,
          dataSubjects: f.dataSubjects || null,
          personalDataCategories: f.personalDataCategories || null,
          lawfulBasis: f.lawfulBasis === "unset" ? null : f.lawfulBasis,
          recipients: f.recipients || null,
          processors: f.processors || null,
          retentionPeriod: f.retentionPeriod || null,
          securityMeasures: f.securityMeasures || null,
          owner: f.owner || null,
          reviewDate: f.reviewDate || null,
          specialCategoryData: f.specialCategoryData,
          internationalTransfers: f.internationalTransfers,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Activity saved");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <SheetHeader>
        <SheetTitle>Edit activity</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <TextField
          label="Activity name"
          value={f.activityName}
          onChange={(v) => set("activityName")(v)}
          required
        />
        <SelectField
          label="Lawful basis"
          value={f.lawfulBasis}
          onChange={(v) => set("lawfulBasis")(v)}
          options={["unset", ...LAWFUL]}
        />
        <TextField
          label="Data subjects"
          value={f.dataSubjects}
          onChange={(v) => set("dataSubjects")(v)}
        />
        <AreaField
          label="Business purpose"
          value={f.businessPurpose}
          onChange={(v) => set("businessPurpose")(v)}
        />
        <AreaField
          label="Personal data categories"
          value={f.personalDataCategories}
          onChange={(v) => set("personalDataCategories")(v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Retention period"
            value={f.retentionPeriod}
            onChange={(v) => set("retentionPeriod")(v)}
          />
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={(v) => set("reviewDate")(v)}
          />
        </div>
        <TextField
          label="Owner"
          value={f.owner}
          onChange={(v) => set("owner")(v)}
        />
        <AreaField
          label="Recipients"
          value={f.recipients}
          onChange={(v) => set("recipients")(v)}
        />
        <AreaField
          label="Processors"
          value={f.processors}
          onChange={(v) => set("processors")(v)}
        />
        <AreaField
          label="Security measures"
          value={f.securityMeasures}
          onChange={(v) => set("securityMeasures")(v)}
        />
        <SwitchField
          label="Special category data"
          checked={f.specialCategoryData}
          onChange={(v) => set("specialCategoryData")(v)}
        />
        <SwitchField
          label="International transfers"
          checked={f.internationalTransfers}
          onChange={(v) => set("internationalTransfers")(v)}
        />
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
