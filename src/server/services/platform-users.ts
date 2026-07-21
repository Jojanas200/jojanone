import { eq } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { sqlClient } from "../db";
import { memberships, userPreferences } from "../db/schema";
import { logPlatformAction, type PlatformActor } from "./platform-admin";

// Cross-tenant USER administration for the platform admin (support + GDPR).
// Reads come from auth.users (service-role SQL); mutating actions use the
// Supabase Auth Admin API. Everything is audited.

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function authAdmin(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL()}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY(),
      Authorization: `Bearer ${SERVICE_KEY()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export interface PlatformUser {
  id: string;
  email: string | null;
  createdAt: Date | null;
  lastSignInAt: Date | null;
  confirmedAt: Date | null;
  bannedUntil: Date | null;
}

export interface UserPage {
  rows: PlatformUser[];
  total: number;
}

export async function listPlatformUsers(opts: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<UserPage> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const like = opts.search?.trim() ? `%${opts.search.trim()}%` : null;

  const rows = like
    ? await sqlClient<PlatformUserRow[]>`
        select id::text as id, email, created_at, last_sign_in_at,
               email_confirmed_at, banned_until
        from auth.users
        where email ilike ${like}
        order by created_at desc limit ${limit} offset ${offset}`
    : await sqlClient<PlatformUserRow[]>`
        select id::text as id, email, created_at, last_sign_in_at,
               email_confirmed_at, banned_until
        from auth.users
        order by created_at desc limit ${limit} offset ${offset}`;

  const totalRows = like
    ? await sqlClient<{ n: number }[]>`
        select count(*)::int as n from auth.users where email ilike ${like}`
    : await sqlClient<
        { n: number }[]
      >`select count(*)::int as n from auth.users`;

  return {
    rows: rows.map(mapUser),
    total: Number(totalRows[0]?.n ?? 0),
  };
}

interface PlatformUserRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
}
const toDate = (v: string | null) => (v ? new Date(v) : null);
function mapUser(r: PlatformUserRow): PlatformUser {
  const banned =
    r.banned_until && new Date(r.banned_until).getTime() > Date.now()
      ? new Date(r.banned_until)
      : null;
  return {
    id: r.id,
    email: r.email,
    createdAt: toDate(r.created_at),
    lastSignInAt: toDate(r.last_sign_in_at),
    confirmedAt: toDate(r.email_confirmed_at),
    bannedUntil: banned,
  };
}

export interface UserMembership {
  workspaceId: string;
  workspaceName: string;
  org: string;
  role: string;
}

export interface PlatformUserDetail extends PlatformUser {
  memberships: UserMembership[];
}

export async function getPlatformUser(
  id: string,
): Promise<PlatformUserDetail | null> {
  const rows = await sqlClient<PlatformUserRow[]>`
    select id::text as id, email, created_at, last_sign_in_at,
           email_confirmed_at, banned_until
    from auth.users where id = ${id}::uuid limit 1`;
  if (!rows[0]) return null;

  const mem = await sqlClient<
    { ws: string; name: string; org: string; role: string }[]
  >`
    select w.id::text as ws, w.name, o.name as org, m.role::text as role
    from memberships m
    join workspaces w on w.id = m.workspace_id
    join organisations o on o.id = w.organisation_id
    where m.user_id = ${id}::uuid
    order by w.created_at desc`;

  return {
    ...mapUser(rows[0]),
    memberships: mem.map((r) => ({
      workspaceId: r.ws,
      workspaceName: r.name,
      org: r.org,
      role: r.role,
    })),
  };
}

export type UserActionResult =
  { ok: true; link?: string } | { ok: false; error: string };

/** Ban (disable) or unban a user. */
export async function setUserBanned(
  actor: PlatformActor,
  id: string,
  banned: boolean,
): Promise<UserActionResult> {
  const res = await authAdmin(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ban_duration: banned ? "876000h" : "none" }),
  });
  if (!res.ok) return { ok: false, error: `Auth API ${res.status}` };
  await logPlatformAction(actor, banned ? "user.disable" : "user.enable", {
    targetUserId: id,
  });
  return { ok: true };
}

/** Mark a user's email as confirmed (for a stuck sign-up). */
export async function confirmUserEmail(
  actor: PlatformActor,
  id: string,
): Promise<UserActionResult> {
  const res = await authAdmin(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ email_confirm: true }),
  });
  if (!res.ok) return { ok: false, error: `Auth API ${res.status}` };
  await logPlatformAction(actor, "user.confirm_email", { targetUserId: id });
  return { ok: true };
}

/** Generate a password-recovery link the operator can pass to the user. */
export async function generateRecoveryLink(
  actor: PlatformActor,
  email: string,
): Promise<UserActionResult> {
  const res = await authAdmin(`/generate_link`, {
    method: "POST",
    body: JSON.stringify({ type: "recovery", email }),
  });
  if (!res.ok) return { ok: false, error: `Auth API ${res.status}` };
  const data = (await res.json()) as {
    action_link?: string;
    properties?: { action_link?: string };
  };
  const link = data.action_link ?? data.properties?.action_link;
  await logPlatformAction(actor, "user.recovery_link", { detail: { email } });
  return { ok: true, link };
}

/**
 * GDPR erasure: remove the user's memberships + preferences, then delete the
 * auth account. Audited. (If they were a sole workspace owner, transfer
 * ownership first - this does not reassign owned workspaces.)
 */
export async function eraseUser(
  actor: PlatformActor,
  id: string,
): Promise<UserActionResult> {
  await adminDb.delete(memberships).where(eq(memberships.userId, id));
  await adminDb.delete(userPreferences).where(eq(userPreferences.userId, id));

  const res = await authAdmin(`/users/${id}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, error: `Auth API ${res.status}` };
  await logPlatformAction(actor, "user.erase", { targetUserId: id });
  return { ok: true };
}
