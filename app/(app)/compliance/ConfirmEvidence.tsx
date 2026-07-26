"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmEvidence({
  obligationId,
  obligationTitle,
}: {
  obligationId: string;
  obligationTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    title: `Evidence - ${obligationTitle}`,
    notes: "",
    fileName: "",
    completeObligation: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/compliance/${obligationId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          category: "compliance",
          notes: f.notes.trim() || undefined,
          fileName: f.fileName.trim() || undefined,
          completeObligation: f.completeObligation,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      toast.success(
        f.completeObligation
          ? "Evidence recorded - obligation completed"
          : "Evidence recorded",
      );
      setOpen(false);
      setF((p) => ({ ...p, notes: "", fileName: "" }));
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Confirm evidence
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm completion &amp; record evidence</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Jojan One doesn&apos;t file on your behalf. Once you&apos;ve
            completed this obligation (e.g. filed at Companies House), record
            the evidence here to mark it done.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Evidence title</Label>
            <Input
              id="ev-title"
              required
              value={f.title}
              onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-file">Reference / file name (optional)</Label>
            <Input
              id="ev-file"
              value={f.fileName}
              onChange={(e) =>
                setF((p) => ({ ...p, fileName: e.target.value }))
              }
              placeholder="e.g. CS01-confirmation.pdf or a receipt number"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-notes">Notes (optional)</Label>
            <Textarea
              id="ev-notes"
              rows={3}
              value={f.notes}
              onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
              placeholder="What was done, when, and where the proof is held."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="ev-complete">Mark obligation complete</Label>
              <p className="text-xs text-muted-foreground">
                Turn off to log evidence while the obligation stays in progress.
              </p>
            </div>
            <Switch
              id="ev-complete"
              checked={f.completeObligation}
              onCheckedChange={(v) =>
                setF((p) => ({ ...p, completeObligation: v === true }))
              }
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving…"
                : f.completeObligation
                  ? "Record & complete"
                  : "Record evidence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
