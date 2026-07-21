import { getPlatformSettings } from "@/server/services/platform-settings";

// Platform-wide announcement shown to every workspace. Set by operators in
// /admin/settings. Renders nothing when there is no active message.
export async function PlatformBanner() {
  let announcement: string | null = null;
  let level = "info";
  try {
    const s = await getPlatformSettings();
    announcement = s.announcement;
    level = s.announcementLevel;
  } catch {
    return null;
  }
  if (!announcement) return null;

  const cls =
    level === "critical"
      ? "bg-red-600 text-white"
      : level === "warning"
        ? "bg-amber-500 text-amber-950"
        : "bg-foreground text-background";

  return (
    <div
      className={`px-4 py-1.5 text-center text-xs font-medium ${cls}`}
      role="status"
    >
      {announcement}
    </div>
  );
}
