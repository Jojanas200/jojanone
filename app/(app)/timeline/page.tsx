import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getTimeline, getActivityFeed } from "@/server/services/timeline";
import { TimelineView } from "./TimelineView";

export default async function TimelinePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "timeline");
  const [feed, upcoming] = await Promise.all([
    getActivityFeed(claims),
    getTimeline(claims),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Timeline
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every event that shaped your business, in one place.
        </p>
      </div>
      <TimelineView
        feed={feed}
        upcoming={upcoming}
        today={today}
        canWrite={access.canWrite}
      />
    </div>
  );
}
