import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getTimeline } from "@/server/services/timeline";
import { TimelineView } from "./TimelineView";

export default async function TimelinePage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "timeline");
  const events = await getTimeline(claims);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Timeline
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every event that shaped your business, in one place.
        </p>
      </div>
      <TimelineView events={events} today={today} />
    </div>
  );
}
