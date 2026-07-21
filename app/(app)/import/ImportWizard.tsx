"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RowError = { row: number; message: string };
type Preview = {
  dataset: string;
  columns: string[];
  totalRows: number;
  validRows: Record<string, unknown>[];
  errors: RowError[];
};
type Result = {
  dataset: string;
  inserted: number;
  totalRows: number;
  errors: RowError[];
};

const DATASETS = [
  { key: "contracts", label: "Contracts" },
  { key: "employees", label: "People" },
  { key: "obligations", label: "Compliance obligations" },
] as const;

export function ImportWizard() {
  const router = useRouter();
  const [dataset, setDataset] = useState<string>("contracts");
  const [csv, setCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setCsv("");
    setFileName("");
    setPreview(null);
    setResult(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setPreview(null);
    setResult(null);
  }

  async function analyse() {
    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, csv, commit: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setPreview(data.preview as Preview);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, csv, commit: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setResult(data.result as Result);
      setPreview(null);
      toast.success(`Imported ${data.result.inserted} record(s)`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1 - choose dataset + file */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          1 · Choose what to import
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {DATASETS.map((d) => (
            <button
              key={d.key}
              onClick={() => {
                setDataset(d.key);
                reset();
              }}
              aria-pressed={dataset === d.key}
              className={`rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                dataset === d.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onFile}
            />
            Choose CSV…
          </label>
          {fileName && (
            <span className="text-sm text-muted-foreground">{fileName}</span>
          )}
          <a
            href={`/api/import/template/${dataset}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Download template
          </a>
          <div className="ml-auto">
            <Button onClick={analyse} disabled={!csv || busy}>
              {busy ? "Checking…" : "Preview"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Step 2 - preview */}
      {preview && (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            2 · Review ({preview.totalRows} rows)
          </h2>
          <div className="mb-4 flex gap-3 text-sm">
            <Badge variant="secondary">{preview.validRows.length} ready</Badge>
            {preview.errors.length > 0 && (
              <Badge variant="destructive">
                {preview.errors.length} rejected
              </Badge>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-4 max-h-52 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Rows that failed validation and why
                </caption>
                <thead className="bg-muted/50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-1.5 text-left font-medium"
                    >
                      Row
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-1.5 text-left font-medium"
                    >
                      Why it was rejected
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((e) => (
                    <tr key={e.row} className="border-t border-border">
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {e.row}
                      </td>
                      <td className="px-3 py-1.5 text-destructive">
                        {e.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={commit}
              disabled={busy || preview.validRows.length === 0}
            >
              {busy
                ? "Importing…"
                : `Import ${preview.validRows.length} record(s)`}
            </Button>
            <Button variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            {preview.errors.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Rejected rows are skipped - fix and re-upload them separately.
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Step 3 - result */}
      {result && (
        <Card className="p-6">
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Import complete
          </h2>
          <p className="text-sm text-muted-foreground">
            Imported{" "}
            <strong className="text-foreground">{result.inserted}</strong> of{" "}
            {result.totalRows} rows
            {result.errors.length > 0
              ? `; ${result.errors.length} skipped.`
              : "."}
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={reset}>
              Import another file
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
