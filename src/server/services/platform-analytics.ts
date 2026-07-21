import { sqlClient } from "../db";

// Cross-tenant analytics computed from existing tables (service-role, read-only).
// No event pipeline yet - these are point-in-time aggregates + a 30-day signup
// trend derived from workspaces.created_at.

export interface PlatformAnalytics {
  workspaces: {
    total: number;
    active: number;
    suspended: number;
    new30: number;
  };
  signupsByDay: { day: string; count: number }[];
  mrrMinor: number;
  arrMinor: number;
  byPlan: { key: string; count: number }[];
  byStatus: { key: string; count: number }[];
  seats: { used: number; allowed: number; utilizationPct: number };
  ai: { conversations: number; messages: number; messages30: number };
}

const num = (v: unknown) => Number(v ?? 0);

export const EMPTY_ANALYTICS: PlatformAnalytics = {
  workspaces: { total: 0, active: 0, suspended: 0, new30: 0 },
  signupsByDay: [],
  mrrMinor: 0,
  arrMinor: 0,
  byPlan: [],
  byStatus: [],
  seats: { used: 0, allowed: 0, utilizationPct: 0 },
  ai: { conversations: 0, messages: 0, messages30: 0 },
};

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  // All scalar aggregates in ONE round-trip; only the genuinely multi-row
  // breakdowns stay separate. Keeps concurrent query count (and pooled-
  // connection pressure) low so the page never trips a statement timeout.
  const [scalars, signups, byPlan, byStatus] = await Promise.all([
    sqlClient<
      {
        total: number;
        active: number;
        suspended: number;
        new30: number;
        mrr: string;
        seats_used: number;
        seats_allowed: string;
        conversations: number;
        messages: number;
        messages30: number;
      }[]
    >`
      select
        (select count(*) from workspaces)::int as total,
        (select count(*) from workspaces where suspended_at is null)::int as active,
        (select count(*) from workspaces where suspended_at is not null)::int as suspended,
        (select count(*) from workspaces where created_at > now() - interval '30 days')::int as new30,
        (select coalesce(sum(p.price_minor), 0)::bigint
           from subscriptions s join plans p on p.key = s.plan_key
           where s.status = 'active') as mrr,
        (select count(*) from memberships)::int as seats_used,
        (select coalesce(sum(seats_allowed), 0)::bigint from subscriptions) as seats_allowed,
        (select count(*) from conversations)::int as conversations,
        (select count(*) from messages)::int as messages,
        (select count(*) from messages where created_at > now() - interval '30 days')::int as messages30`,
    sqlClient<{ day: string; count: number }[]>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*)::int as count
      from workspaces
      where created_at > now() - interval '30 days'
      group by 1 order by 1`,
    sqlClient<{ key: string; count: number }[]>`
      select coalesce(plan_key, 'none') as key, count(*)::int as count
      from subscriptions group by 1 order by 2 desc`,
    sqlClient<{ key: string; count: number }[]>`
      select coalesce(status, 'none') as key, count(*)::int as count
      from subscriptions group by 1 order by 2 desc`,
  ]);

  const s = scalars[0];
  const used = num(s?.seats_used);
  const allowed = num(s?.seats_allowed);
  const mrrMinor = num(s?.mrr);

  return {
    workspaces: {
      total: num(s?.total),
      active: num(s?.active),
      suspended: num(s?.suspended),
      new30: num(s?.new30),
    },
    signupsByDay: signups.map((r) => ({ day: r.day, count: num(r.count) })),
    mrrMinor,
    arrMinor: mrrMinor * 12,
    byPlan: byPlan.map((r) => ({ key: r.key, count: num(r.count) })),
    byStatus: byStatus.map((r) => ({ key: r.key, count: num(r.count) })),
    seats: {
      used,
      allowed,
      utilizationPct: allowed > 0 ? Math.round((used / allowed) * 100) : 0,
    },
    ai: {
      conversations: num(s?.conversations),
      messages: num(s?.messages),
      messages30: num(s?.messages30),
    },
  };
}
