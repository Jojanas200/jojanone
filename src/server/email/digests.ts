import { and, eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { memberships, notifications, workspaces } from "../db/schema";
import { sendEmail, type EmailProvider } from "./provider";
import { reminderDigestEmail } from "./templates";

// Reminder email digests. Runs after the reminder engine (from the cron): for
// each workspace with unread notifications, email the owner a digest. Uses
// adminDb (no user session) and the Supabase admin API to resolve the owner's
// email. Both the email transport and the email-lookup are injectable so the
// verifier can run without a real provider or real auth users.

export type EmailLookup = (userId: string) => Promise<string | null>;

// Default: resolve a user's email from the Supabase Auth admin API.
const defaultLookup: EmailLookup = async (userId) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
};

export interface DigestResult {
  workspaces: number;
  sent: number;
  skipped: number;
}

export async function sendReminderDigests(opts?: {
  emailProvider?: EmailProvider;
  lookupEmail?: EmailLookup;
  onlyWorkspaceId?: string;
}): Promise<DigestResult> {
  const lookup = opts?.lookupEmail ?? defaultLookup;
  const result: DigestResult = { workspaces: 0, sent: 0, skipped: 0 };

  const wsRows = opts?.onlyWorkspaceId
    ? await adminDb
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, opts.onlyWorkspaceId))
    : await adminDb
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces);

  for (const ws of wsRows) {
    result.workspaces++;

    const unread = await adminDb
      .select({
        title: notifications.title,
        description: notifications.description,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, ws.id),
          eq(notifications.read, false),
        ),
      );
    if (unread.length === 0) {
      result.skipped++;
      continue;
    }

    const owner = (
      await adminDb
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, ws.id),
            eq(memberships.role, "owner_admin"),
          ),
        )
        .limit(1)
    )[0];
    const email = owner ? await lookup(owner.userId) : null;
    if (!email) {
      result.skipped++;
      continue;
    }

    const { subject, html, text } = reminderDigestEmail({
      workspaceName: ws.name,
      items: unread.map((u) => ({
        title: u.title,
        description: u.description,
      })),
    });
    const sendResult = await sendEmail(
      { to: email, subject, html, text },
      { provider: opts?.emailProvider },
    );
    if (sendResult.ok) result.sent++;
    else result.skipped++;
  }

  return result;
}
