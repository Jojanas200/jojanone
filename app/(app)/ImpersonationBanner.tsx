"use client";
import { useState } from "react";

export function ImpersonationBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  async function stop() {
    setBusy(true);
    await fetch("/api/admin/impersonate/stop", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
      <span>
        Impersonating <strong>{email}</strong> — you are acting as this user.
      </span>
      <button
        onClick={stop}
        disabled={busy}
        className="rounded bg-amber-950/10 px-2 py-0.5 underline hover:bg-amber-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-950"
      >
        {busy ? "Stopping…" : "Stop impersonating"}
      </button>
    </div>
  );
}
