import { NextResponse } from "next/server";
import { generateAllReminders } from "@/server/services/reminders";
import { sendReminderDigests } from "@/server/email/digests";
import { isEmailConfigured } from "@/server/email/provider";

// Secured cron entry point for the reminder engine. Protect with a shared
// secret so only a trusted scheduler (Supabase pg_cron via net.http_post, a
// platform cron, etc.) can trigger it.
//
// Example pg_cron job (run daily at 07:00 UTC):
//   select cron.schedule('jojan-reminders', '0 7 * * *', $$
//     select net.http_post(
//       url    := 'https://<app-host>/api/cron/reminders',
//       headers:= jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
//     );
//   $$);

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await generateAllReminders();

  // Best-effort email digests (only when an email provider is configured).
  let digests = null;
  if (isEmailConfigured()) {
    try {
      digests = await sendReminderDigests();
    } catch {
      digests = { error: "digest send failed" };
    }
  }

  return NextResponse.json({ ok: true, ...result, digests });
}
