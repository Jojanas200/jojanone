import { sqlClient } from "../db";
import { adminDb } from "../db/admin";
import { platformEvents } from "../db/schema";

// Product event stream + usage analytics (cross-tenant, service-role).
//
// trackEvent is fire-and-forget: analytics must NEVER break a user request, so
// it swallows its own errors. Events feed DAU/WAU/MAU, usage-over-time and top
// actions on the platform-admin analytics page.

export interface TrackEventInput {
  name: string;
  userId?: string | null;
  workspaceId?: string | null;
  module?: string | null;
  metadata?: Record<string, unknown>;
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await adminDb.insert(platformEvents).values({
      name: input.name,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      module: input.module ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Never propagate - usage tracking is best-effort.
  }
}

export const HEARTBEAT_EVENT = "session.active";
const HEARTBEAT_THROTTLE_MINUTES = 20;

/**
 * Record a session heartbeat for the active user - this is what makes DAU/WAU/
 * MAU reflect ALL active users, not only those firing a specific action. Server-
 * throttled to at most one per user per window so the event table stays lean.
 * Returns whether the write was throttled. Best-effort (never throws).
 */
export async function recordHeartbeat(
  userId: string,
  workspaceId?: string | null,
): Promise<{ throttled: boolean }> {
  try {
    const recent = await sqlClient`
      select 1 from platform_events
      where user_id = ${userId}::uuid
        and name = ${HEARTBEAT_EVENT}
        and created_at > now() - (${HEARTBEAT_THROTTLE_MINUTES} || ' minutes')::interval
      limit 1`;
    if (recent.length) return { throttled: true };
    await trackEvent({
      name: HEARTBEAT_EVENT,
      userId,
      workspaceId: workspaceId ?? null,
      module: "session",
    });
    return { throttled: false };
  } catch {
    return { throttled: true };
  }
}

export interface UsageAnalytics {
  activeUsers: { dau: number; wau: number; mau: number };
  activeWorkspaces7d: number;
  returningUsers7d: number;
  eventsByDay: { day: string; count: number }[];
  topEvents: { name: string; count: number }[];
  totalEvents30d: number;
}

const num = (v: unknown) => Number(v ?? 0);

export const EMPTY_USAGE: UsageAnalytics = {
  activeUsers: { dau: 0, wau: 0, mau: 0 },
  activeWorkspaces7d: 0,
  returningUsers7d: 0,
  eventsByDay: [],
  topEvents: [],
  totalEvents30d: 0,
};

export async function getUsageAnalytics(): Promise<UsageAnalytics> {
  // Scalars in ONE round-trip; only the multi-row breakdowns stay separate.
  const [scalars, returning, byDay, top] = await Promise.all([
    sqlClient<
      { dau: number; wau: number; mau: number; ws7: number; total30: number }[]
    >`
        select
          count(distinct user_id) filter (where created_at > now() - interval '1 day' and user_id is not null)::int as dau,
          count(distinct user_id) filter (where created_at > now() - interval '7 days' and user_id is not null)::int as wau,
          count(distinct user_id) filter (where created_at > now() - interval '30 days' and user_id is not null)::int as mau,
          count(distinct workspace_id) filter (where created_at > now() - interval '7 days' and workspace_id is not null)::int as ws7,
          count(*) filter (where created_at > now() - interval '30 days')::int as total30
        from platform_events`,
    // Users active in the last 7 days who were ALSO active in the prior 7-14 days.
    sqlClient<{ n: number }[]>`
        select count(*)::int as n from (
          select user_id
          from platform_events
          where user_id is not null and created_at > now() - interval '7 days'
          intersect
          select user_id
          from platform_events
          where user_id is not null
            and created_at <= now() - interval '7 days'
            and created_at > now() - interval '14 days'
        ) r`,
    sqlClient<{ day: string; count: number }[]>`
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
               count(*)::int as count
        from platform_events
        where created_at > now() - interval '30 days'
        group by 1 order by 1`,
    sqlClient<{ name: string; count: number }[]>`
        select name, count(*)::int as count
        from platform_events
        where created_at > now() - interval '30 days'
          and name <> ${HEARTBEAT_EVENT}
        group by 1 order by 2 desc limit 10`,
  ]);

  const s = scalars[0];
  return {
    activeUsers: {
      dau: num(s?.dau),
      wau: num(s?.wau),
      mau: num(s?.mau),
    },
    activeWorkspaces7d: num(s?.ws7),
    returningUsers7d: num(returning[0]?.n),
    eventsByDay: byDay.map((r) => ({ day: r.day, count: num(r.count) })),
    topEvents: top.map((r) => ({ name: r.name, count: num(r.count) })),
    totalEvents30d: num(s?.total30),
  };
}
