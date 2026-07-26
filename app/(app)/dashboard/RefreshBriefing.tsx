"use client";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// The briefing/score is computed live on every load, so "refresh" re-renders
// the server components with the latest workspace data.
export function RefreshBriefing() {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      Refresh briefing
    </Button>
  );
}
