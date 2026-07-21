"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
} from "@/shared/schemas/documents";

type Doc = {
  id: string;
  title: string;
  category: string;
  originalName: string | null;
  accessLevel: string;
};

const DOC_CATEGORIES = [
  "Incorporation documents",
  "Organisation / ownership chart",
  "Policies",
  "Insurance certificates",
  "Contracts",
  "Employee handbook",
  "Statutory accounts",
  "Risk register",
  "Governance records",
  "GDPR records",
  "Compliance calendar",
  "Other",
];

export function DocumentUploader({
  variant,
  ensureSaved,
}: {
  variant: "documents" | "logo";
  ensureSaved: () => Promise<boolean>;
}) {
  const isLogo = variant === "logo";
  const sourceModule = isLogo ? "branding" : "onboarding";
  const accept = (isLogo ? ALLOWED_IMAGE_MIME : ALLOWED_DOCUMENT_MIME).join(
    ",",
  );

  const [docs, setDocs] = useState<Doc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState({
    title: "",
    category: DOC_CATEGORIES[0],
    issueDate: "",
    reviewDate: "",
    accessLevel: "workspace",
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/onboarding/documents?sourceModule=${sourceModule}`)
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((d) => setDocs(d.documents ?? []))
      .catch(() => {});
  }, [sourceModule]);

  function pick(f: File | null) {
    setFile(f);
    if (f && !meta.title)
      setMeta((m) => ({ ...m, title: f.name.replace(/\.[^.]+$/, "") }));
    if (isLogo && f) void upload(f);
  }

  async function upload(f: File) {
    setBusy(true);
    try {
      if (!(await ensureSaved())) return;
      const fd = new FormData();
      fd.append("file", f);
      fd.append("sourceModule", sourceModule);
      if (isLogo) {
        fd.append("title", f.name);
        fd.append("category", "Brand logo");
      } else {
        fd.append("title", meta.title || f.name);
        fd.append("category", meta.category);
        if (meta.issueDate) fd.append("issueDate", meta.issueDate);
        if (meta.reviewDate) fd.append("reviewDate", meta.reviewDate);
        fd.append("accessLevel", meta.accessLevel);
      }
      const res = await fetch("/api/onboarding/documents", {
        method: "POST",
        body: fd,
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Upload failed",
        );
      const { document } = (await res.json()) as { document: Doc };
      setDocs((d) => [document, ...d]);
      setFile(null);
      setMeta((m) => ({ ...m, title: "", issueDate: "", reviewDate: "" }));
      if (inputRef.current) inputRef.current.value = "";
      toast.success(isLogo ? "Logo uploaded" : "Document uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    const res = await fetch(`/api/onboarding/documents/${id}`);
    if (!res.ok) return toast.error("Could not open");
    const { url } = (await res.json()) as { url: string };
    window.open(url, "_blank", "noopener");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/onboarding/documents/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDocs((d) => d.filter((x) => x.id !== id));
      toast.success("Removed");
    } else toast.error("Could not remove");
  }

  return (
    <div className="space-y-3">
      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                {d.title}
                {!isLogo && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {d.category}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Download"
                  onClick={() => download(d.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => remove(d.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!isLogo && file && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Title</Label>
            <Input
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select
              value={meta.category}
              onValueChange={(v) => setMeta({ ...meta, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Access</Label>
            <Select
              value={meta.accessLevel}
              onValueChange={(v) => setMeta({ ...meta, accessLevel: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">All members</SelectItem>
                <SelectItem value="restricted">Owners only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Issue date</Label>
            <Input
              type="date"
              value={meta.issueDate}
              onChange={(e) => setMeta({ ...meta, issueDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Review / expiry</Label>
            <Input
              type="date"
              value={meta.reviewDate}
              onChange={(e) => setMeta({ ...meta, reviewDate: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => file && upload(file)}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-muted"
      />
      <p className="text-xs text-muted-foreground">
        {isLogo
          ? "PNG, JPG or WebP."
          : "PDF, Word, Excel, CSV or images, up to 50MB. Stored privately in your Evidence library."}
      </p>
    </div>
  );
}
