"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Renders a policy's document body. When the workspace member can write, they
// can edit the drafted content inline and save it back to the policy.
export function PolicyDocument({
  policyId,
  content,
  canWrite,
}: {
  policyId: string;
  content: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success("Document saved");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Policy document
        </h2>
        <div className="flex gap-2">
          {content && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(content);
                toast.success("Copied");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
          )}
          {canWrite && !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(content ?? "");
                setEditing(true);
              }}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {content ? "Edit" : "Write document"}
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={22}
            className="font-mono text-sm leading-relaxed"
            aria-label="Policy document"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save document"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : content ? (
        <article className="whitespace-pre-wrap rounded-xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground">
          {content}
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No document body yet. Ask Jova to draft one from the Policies page, or
          write your own here.
        </div>
      )}
    </div>
  );
}
