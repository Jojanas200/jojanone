import { Suspense } from "react";
import { AcceptInvite } from "./AcceptInvite";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AcceptInvite />
    </Suspense>
  );
}
