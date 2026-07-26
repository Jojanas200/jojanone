"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AreaField,
  Block,
  Field,
  SelectField,
  TextField,
} from "../_shared/board-bits";
import { fmtDate } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import type { listPrivacyNotices } from "@/server/services/gdpr-registers";

type Notice = Awaited<ReturnType<typeof listPrivacyNotices>>[number];

const STATUSES = ["draft", "published"];

export function PrivacyNoticesBoard({
  notices,
  canWrite,
}: {
  notices: Notice[];
  canWrite: boolean;
}) {
  const [active, setActive] = useState<Notice | "new" | null>(null);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Your published privacy notice tells people how you use their data.
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setActive("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            New notice
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {notices.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No privacy notice yet. Draft one to explain how you handle personal
            data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((n) => (
                  <TableRow
                    key={n.id}
                    onClick={() => setActive(n)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">
                      v{n.version}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {n.organisation || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          n.status === "published" ? "secondary" : "outline"
                        }
                      >
                        {n.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(n.reviewDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <NoticeDrawer
        item={active}
        canWrite={canWrite}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function NoticeDrawer({
  item,
  canWrite,
  onClose,
}: {
  item: Notice | "new" | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const creating = item === "new";
  const close = () => {
    setEditing(false);
    onClose();
  };
  return (
    <Sheet open={!!item} onOpenChange={(v) => !v && close()}>
      <SheetContent
        className={`w-full overflow-y-auto ${
          creating || editing ? "sm:max-w-4xl" : "sm:max-w-lg"
        }`}
      >
        {item &&
          (creating || editing ? (
            <NoticeForm
              notice={creating ? null : (item as Notice)}
              onDone={() => {
                setEditing(false);
                if (creating) close();
                router.refresh();
              }}
              onCancel={() => (creating ? close() : setEditing(false))}
            />
          ) : (
            <NoticeView
              notice={item as Notice}
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

function NoticeView({
  notice: n,
  canWrite,
  onEdit,
  onChanged,
  onClosed,
}: {
  notice: Notice;
  canWrite: boolean;
  onEdit: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/notices/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(msg);
      onChanged();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this notice?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gdpr/notices/${n.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Notice deleted");
      onChanged();
      onClosed();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function printNotice() {
    const section = (heading: string, body: string | null) =>
      body ? [{ kind: "text" as const, heading, body }] : [];
    const blocks: PrintBlock[] = [
      ...section("Contact", n.contactDetails),
      ...section("Data we collect", n.dataCollected),
      ...section("Purposes", n.purposes),
      ...(n.lawfulBases.length > 0
        ? [
            {
              kind: "text" as const,
              heading: "Lawful bases",
              body: n.lawfulBases.join(", "),
            },
          ]
        : []),
      ...section("Sharing", n.sharing),
      ...section("International transfers", n.internationalTransfers),
      ...section("Retention", n.retention),
      ...section("Your rights", n.rights),
      ...section("Complaints", n.complaints),
    ];
    printDocument({
      title: `${n.organisation || "Privacy notice"} - Privacy notice`,
      meta: `Version ${n.version} · ${n.status}`,
      banner: n.status === "draft" ? "Draft - review before use" : undefined,
      blocks,
      disclaimer: "Not legally approved; have material notices reviewed.",
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Privacy notice v{n.version}</SheetTitle>
      </SheetHeader>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={printNotice}>
          Print / PDF
        </Button>
      </div>
      <div className="mt-3 space-y-4 text-sm">
        <dl className="space-y-3">
          <Field label="Status">
            <Badge variant={n.status === "published" ? "secondary" : "outline"}>
              {n.status}
            </Badge>
          </Field>
          <Field label="Organisation">{n.organisation || "-"}</Field>
          <Field label="Review date">{fmtDate(n.reviewDate)}</Field>
        </dl>
        {n.dataCollected && (
          <Block label="Data collected" body={n.dataCollected} />
        )}
        {n.purposes && <Block label="Purposes" body={n.purposes} />}
        {n.lawfulBases.length > 0 && (
          <Block label="Lawful bases" body={n.lawfulBases.join(", ")} />
        )}
        {n.sharing && <Block label="Sharing" body={n.sharing} />}
        {n.internationalTransfers && (
          <Block
            label="International transfers"
            body={n.internationalTransfers}
          />
        )}
        {n.retention && <Block label="Retention" body={n.retention} />}
        {n.rights && <Block label="Rights" body={n.rights} />}
        {n.complaints && <Block label="Complaints" body={n.complaints} />}
        {n.contactDetails && <Block label="Contact" body={n.contactDetails} />}

        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            {n.status !== "published" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({ status: "published" }, "Notice published")
                }
                disabled={busy}
              >
                Publish
              </Button>
            )}
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

function NoticeForm({
  notice: n,
  onDone,
  onCancel,
}: {
  notice: Notice | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    version: n?.version ?? "1.0",
    status: n?.status ?? "draft",
    organisation: n?.organisation ?? "",
    contactDetails: n?.contactDetails ?? "",
    dataCollected: n?.dataCollected ?? "",
    purposes: n?.purposes ?? "",
    lawfulBases: (n?.lawfulBases ?? []).join(", "),
    sharing: n?.sharing ?? "",
    internationalTransfers: n?.internationalTransfers ?? "",
    retention: n?.retention ?? "",
    rights: n?.rights ?? "",
    complaints: n?.complaints ?? "",
    reviewDate: n?.reviewDate ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        version: f.version || "1.0",
        status: f.status,
        organisation: f.organisation || null,
        contactDetails: f.contactDetails || null,
        dataCollected: f.dataCollected || null,
        purposes: f.purposes || null,
        lawfulBases: f.lawfulBases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        sharing: f.sharing || null,
        internationalTransfers: f.internationalTransfers || null,
        retention: f.retention || null,
        rights: f.rights || null,
        complaints: f.complaints || null,
        reviewDate: f.reviewDate || null,
      };
      const res = await fetch(
        n ? `/api/gdpr/notices/${n.id}` : "/api/gdpr/notices",
        {
          method: n ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(n ? "Notice saved" : "Notice created");
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
        <SheetTitle>
          {n ? "Privacy notice builder" : "New privacy notice"}
        </SheetTitle>
      </SheetHeader>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Version"
              value={f.version}
              onChange={set("version")}
            />
            <SelectField
              label="Status"
              value={f.status}
              onChange={set("status")}
              options={STATUSES}
            />
          </div>
          <TextField
            label="Organisation"
            value={f.organisation}
            onChange={set("organisation")}
          />
          <AreaField
            label="Data collected"
            value={f.dataCollected}
            onChange={set("dataCollected")}
          />
          <AreaField
            label="Purposes"
            value={f.purposes}
            onChange={set("purposes")}
          />
          <TextField
            label="Lawful bases (comma-separated)"
            value={f.lawfulBases}
            onChange={set("lawfulBases")}
          />
          <AreaField
            label="Sharing"
            value={f.sharing}
            onChange={set("sharing")}
          />
          <AreaField
            label="International transfers"
            value={f.internationalTransfers}
            onChange={set("internationalTransfers")}
          />
          <AreaField
            label="Retention"
            value={f.retention}
            onChange={set("retention")}
          />
          <AreaField label="Rights" value={f.rights} onChange={set("rights")} />
          <AreaField
            label="Complaints"
            value={f.complaints}
            onChange={set("complaints")}
          />
          <AreaField
            label="Contact details"
            value={f.contactDetails}
            onChange={set("contactDetails")}
          />
          <TextField
            label="Review date"
            type="date"
            value={f.reviewDate}
            onChange={set("reviewDate")}
          />
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : n ? "Save changes" : "Create notice"}
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

        {/* Live preview - renders the notice as the public would read it. */}
        <div className="hidden lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          <div className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed">
            {f.status === "draft" && (
              <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-foreground">
                Draft - review before use
              </div>
            )}
            <p className="text-base font-semibold text-foreground">
              {f.organisation || "Your organisation"} - Privacy notice
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Version {f.version || "1.0"}
            </p>
            {(
              [
                ["Contact", f.contactDetails],
                ["Data we collect", f.dataCollected],
                ["Purposes", f.purposes],
                ["Lawful bases", f.lawfulBases],
                ["Sharing", f.sharing],
                ["International transfers", f.internationalTransfers],
                ["Retention", f.retention],
                ["Your rights", f.rights],
                ["Complaints", f.complaints],
              ] as const
            ).map(([heading, body]) => (
              <div key={heading} className="mt-3">
                <p className="text-xs font-semibold text-foreground">
                  {heading}
                </p>
                <p
                  className={`whitespace-pre-wrap ${body ? "text-foreground" : "italic text-muted-foreground"}`}
                >
                  {body || "Not completed yet"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
