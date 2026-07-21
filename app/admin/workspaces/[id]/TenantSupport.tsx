"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Note = {
  id: string;
  authorEmail: string | null;
  body: string;
  createdAt: string | Date;
};

const fmt = (d: string | Date) => new Date(d).toLocaleString("en-GB");

export function TenantSupport({
  workspaceId,
  notes,
}: {
  workspaceId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, payload: unknown, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(ok);
      router.refresh();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Notes */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Internal notes
        </h3>
        <div className="flex gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a private note about this tenant…"
            className="h-9"
          />
          <Button
            size="sm"
            disabled={busy || !note.trim()}
            onClick={async () => {
              if (await post("notes", { body: note }, "Note added"))
                setNote("");
            }}
          >
            Add
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {notes.length === 0 && (
            <li className="text-xs text-muted-foreground">No notes yet.</li>
          )}
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-border bg-muted/30 p-2.5 text-sm"
            >
              <p className="text-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {n.authorEmail ?? "operator"} · {fmt(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Broadcast + export */}
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Send a notification
          </h3>
          <div className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="h-9"
            />
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description (optional)"
              className="h-9"
            />
            <Button
              size="sm"
              disabled={busy || !title.trim()}
              onClick={async () => {
                if (
                  await post(
                    "broadcast",
                    { title, description: desc },
                    "Notification sent to the workspace",
                  )
                ) {
                  setTitle("");
                  setDesc("");
                }
              }}
            >
              Send to workspace
            </Button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Export</h3>
          <a
            href={`/api/admin/workspaces/${workspaceId}/export`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Download tenant summary (JSON)
          </a>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Account, subscription, members and record counts. No business
            records.
          </p>
        </div>
      </div>
    </div>
  );
}
