"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import { ADVISER_SCOPABLE_MODULES } from "@/config/modules.config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Member = {
  id: string;
  userId: string;
  role: string;
  scopedModules: string[] | null;
  email: string | null;
  createdAt: string | Date;
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner_admin", label: "Owner (co-owner)" },
  { value: "manager", label: "Manager" },
  { value: "team_member", label: "Team member" },
  { value: "adviser", label: "Adviser" },
  { value: "read_only", label: "Read only" },
];

const STEP_DOWN_OPTIONS: { value: string; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "team_member", label: "Team member" },
  { value: "read_only", label: "Read only" },
];

const roleLabel = (r: string) =>
  r === "owner_admin" ? "Owner" : r.replace(/_/g, " ");

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    // Pin the zone so server-render and client-hydration produce identical text.
    timeZone: "Europe/London",
  });

export function MembersTable({
  members,
  currentUserId,
  isOwner,
}: {
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scopeFor, setScopeFor] = useState<Member | null>(null);
  const [transferFor, setTransferFor] = useState<Member | null>(null);

  async function call(id: string, init: RequestInit, ok: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/members/${id}`, init);
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(id: string, role: string) {
    call(
      id,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      },
      "Role updated",
    );
  }

  function remove(id: string, label: string) {
    if (!window.confirm(`Remove ${label} from this workspace?`)) return;
    call(id, { method: "DELETE" }, "Member removed");
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {isOwner && <TableHead className="text-right">Manage</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const you = m.userId === currentUserId;
            const label = m.email ?? `${m.userId.slice(0, 8)}…`;
            const busy = busyId === m.id;
            return (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-foreground">
                  {label}
                  {you && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {isOwner && !you ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={m.role}
                        onValueChange={(v) => changeRole(m.id, v)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {m.role === "adviser" && (
                        <span className="text-xs text-muted-foreground">
                          {m.scopedModules?.length
                            ? `${m.scopedModules.length} module${m.scopedModules.length === 1 ? "" : "s"}`
                            : "all modules"}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(m.createdAt)}
                </TableCell>
                {isOwner && (
                  <TableCell>
                    {you ? (
                      <span className="block text-right text-xs text-muted-foreground">
                        -
                      </span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        {m.role === "adviser" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setScopeFor(m)}
                          >
                            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                            Scope
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setTransferFor(m)}
                        >
                          <UserCog className="mr-1 h-3.5 w-3.5" />
                          Transfer
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={busy}
                          aria-label={`Remove ${label}`}
                          onClick={() => remove(m.id, label)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {scopeFor && (
        <ScopeDialog
          member={scopeFor}
          onClose={() => setScopeFor(null)}
          onSaved={() => {
            setScopeFor(null);
            router.refresh();
          }}
        />
      )}
      {transferFor && (
        <TransferDialog
          member={transferFor}
          onClose={() => setTransferFor(null)}
          onDone={() => {
            setTransferFor(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ScopeDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const label = member.email ?? `${member.userId.slice(0, 8)}…`;
  const [scoped, setScoped] = useState<string[]>(member.scopedModules ?? []);
  const [saving, setSaving] = useState(false);

  function toggle(key: string, on: boolean) {
    setScoped((prev) =>
      on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key),
    );
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/team/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopedModules: scoped }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Adviser scope updated");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adviser access</DialogTitle>
          <DialogDescription>
            Choose which modules {label} can see. Leave all unchecked to give
            access to everything. Settings is always available.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {ADVISER_SCOPABLE_MODULES.map((m) => {
            const id = `edit-scope-${m.key}`;
            return (
              <label
                key={m.key}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
              >
                <Checkbox
                  id={id}
                  checked={scoped.includes(m.key)}
                  onCheckedChange={(v) => toggle(m.key, v === true)}
                />
                {m.title}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {scoped.length > 0
            ? `Sees ${scoped.length} module${scoped.length === 1 ? "" : "s"} plus Settings.`
            : "Full read-only access to every module."}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  member,
  onClose,
  onDone,
}: {
  member: Member;
  onClose: () => void;
  onDone: () => void;
}) {
  const label = member.email ?? `${member.userId.slice(0, 8)}…`;
  const [stepDownRole, setStepDownRole] = useState("manager");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/team/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: member.id, stepDownRole }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Ownership transferred");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            {label} becomes the workspace owner. You step down to the role below
            and lose owner privileges - only an owner can undo this.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Your new role</Label>
          <Select value={stepDownRole} onValueChange={setStepDownRole}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_DOWN_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Transferring…" : "Transfer ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
