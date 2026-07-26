"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "jj_hide_setup_banner";

/**
 * Discoverable entry point back into the onboarding wizard while setup is
 * incomplete. Dismissible for the session (comes back on next sign-in). Only
 * rendered by the server when onboarding isn't complete.
 */
export function FinishSetupBanner({ missing }: { missing: number }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY) === "1") setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Finish setting up your workspace
          </p>
          <p className="text-xs text-muted-foreground">
            {missing > 0
              ? `${missing} required item${missing === 1 ? "" : "s"} left. `
              : ""}
            Pick up where you left off - your answers are saved.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild size="sm">
          <Link href="/onboarding">Resume setup</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={() => {
            sessionStorage.setItem(KEY, "1");
            setHidden(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
