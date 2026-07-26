"use client";
import { useState } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Version = {
  id: string;
  version: string;
  status: string;
  policyName: string;
  content: string | null;
  createdAt: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// Version history is captured automatically each time a policy is published.
export function PolicyVersionHistory({ versions }: { versions: Version[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
        <History className="h-4 w-4 text-muted-foreground" />
        Version history
      </h2>
      {versions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No published versions yet. Each time this policy is published, a
          snapshot of its content is captured here for audit.
        </Card>
      ) : (
        <ol className="space-y-2">
          {versions.map((v) => (
            <li key={v.id}>
              <Card className="p-0">
                <button
                  type="button"
                  onClick={() => setOpen(open === v.id ? null : v.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{v.version}</Badge>
                    <span className="text-sm text-foreground">Published</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fmt(v.createdAt)}
                  </span>
                </button>
                {open === v.id && (
                  <div className="border-t border-border px-4 py-3">
                    {v.content ? (
                      <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {v.content}
                      </article>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No document body was captured in this version.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
