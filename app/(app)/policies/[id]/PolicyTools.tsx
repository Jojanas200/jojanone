"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Copy, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POLICY_CATEGORIES } from "@/shared/schemas/policies";

export type PolicyLite = {
  id: string;
  policyName: string;
  policyCategory: string | null;
  version: string;
  owner: string | null;
  status: string;
  approvalDate: string | null;
  reviewDate: string | null;
  acknowledgementRequired: boolean;
  notes: string | null;
  content: string | null;
  professionalReviewStatus: string;
  professionalReviewNote: string | null;
};

// Header actions: duplicate as a draft copy, archive/restore.
export function PolicyHeaderActions({ policy: p }: { policy: PolicyLite }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyName: `${p.policyName} (copy)`,
          policyCategory: p.policyCategory,
          version: "1.0",
          status: "draft",
          owner: p.owner,
          acknowledgementRequired: p.acknowledgementRequired,
          notes: p.notes,
          content: p.content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      toast.success("Policy duplicated as draft");
      router.push(`/policies/${data.policy.id}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string, message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/policies/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(message);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={duplicate} disabled={busy}>
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Duplicate
      </Button>
      {p.status === "archived" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("draft", "Policy restored to draft")}
          disabled={busy}
        >
          <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
          Restore
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("archived", "Policy archived")}
          disabled={busy}
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          Archive
        </Button>
      )}
    </div>
  );
}

// Properties tab: edit the register fields in place.
export function PolicyProperties({
  policy: p,
  canWrite,
}: {
  policy: PolicyLite;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    policyName: p.policyName,
    policyCategory: p.policyCategory ?? POLICY_CATEGORIES[0],
    version: p.version,
    owner: p.owner ?? "",
    status: p.status,
    approvalDate: p.approvalDate ?? "",
    reviewDate: p.reviewDate ?? "",
    acknowledgementRequired: p.acknowledgementRequired,
    notes: p.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/policies/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyName: f.policyName,
          policyCategory: f.policyCategory,
          version: f.version || "1.0",
          owner: f.owner || null,
          status: f.status,
          approvalDate: f.approvalDate || null,
          reviewDate: f.reviewDate || null,
          acknowledgementRequired: f.acknowledgementRequired,
          notes: f.notes || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Properties saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pp-name">Policy name</Label>
            <Input
              id="pp-name"
              required
              value={f.policyName}
              onChange={(e) => set("policyName")(e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={f.policyCategory}
              onValueChange={set("policyCategory")}
              disabled={!canWrite}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-version">Version</Label>
            <Input
              id="pp-version"
              value={f.version}
              onChange={(e) => set("version")(e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={f.status}
              onValueChange={set("status")}
              disabled={!canWrite}
            >
              <SelectTrigger className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["draft", "active", "archived"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-owner">Owner</Label>
            <Input
              id="pp-owner"
              value={f.owner}
              onChange={(e) => set("owner")(e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-approval">Approval date</Label>
            <Input
              id="pp-approval"
              type="date"
              value={f.approvalDate}
              onChange={(e) => set("approvalDate")(e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-review">Next review</Label>
            <Input
              id="pp-review"
              type="date"
              value={f.reviewDate}
              onChange={(e) => set("reviewDate")(e.target.value)}
              disabled={!canWrite}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label htmlFor="pp-ack">Requires staff sign-off</Label>
            <p className="text-xs text-muted-foreground">
              Track acknowledgements from your team.
            </p>
          </div>
          <Switch
            id="pp-ack"
            checked={f.acknowledgementRequired}
            onCheckedChange={(v) => set("acknowledgementRequired")(v === true)}
            disabled={!canWrite}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-notes">Notes</Label>
          <Textarea
            id="pp-notes"
            rows={3}
            value={f.notes}
            onChange={(e) => set("notes")(e.target.value)}
            disabled={!canWrite}
          />
        </div>
        {canWrite && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save properties"}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

// Professional review tab: record whether expert review happened.
export function ProfessionalReview({
  policy: p,
  canWrite,
}: {
  policy: PolicyLite;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(p.professionalReviewNote ?? "");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/policies/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(message);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusBadge: Record<
    string,
    "outline" | "warning" | "success" | "secondary" | "destructive"
  > = { not_required: "outline", recommended: "warning", reviewed: "success" };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-foreground">
          Professional review:{" "}
          <Badge
            variant={statusBadge[p.professionalReviewStatus] ?? "outline"}
            className="capitalize"
          >
            {p.professionalReviewStatus.replace(/_/g, " ")}
          </Badge>
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pr-note">Notes from professional review</Label>
        <Textarea
          id="pr-note"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Reviewed by [firm/adviser], date, key changes recommended."
          disabled={!canWrite}
        />
      </div>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              patch(
                {
                  professionalReviewStatus: "reviewed",
                  professionalReviewNote: note || null,
                },
                "Professional review recorded",
              )
            }
            disabled={busy}
          >
            Record as reviewed
          </Button>
          {p.professionalReviewStatus !== "recommended" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch(
                  { professionalReviewStatus: "recommended" },
                  "Marked as recommended",
                )
              }
              disabled={busy}
            >
              Mark recommended
            </Button>
          )}
          {p.professionalReviewStatus !== "not_required" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch(
                  { professionalReviewStatus: "not_required" },
                  "Marked not required",
                )
              }
              disabled={busy}
            >
              Mark not required
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Jojan One does not provide legal advice. Where professional judgement is
        required, record the adviser and date here for your audit trail.
      </p>
    </Card>
  );
}
