import { sqlClient } from "../db";

// Cross-tenant billing operations for the platform admin: current MRR/ARR, the
// subscription funnel, new-MRR and churn trends, and a past-due / recent-event
// list. Derived from the subscriptions + plans + billing_events tables (no
// historical MRR snapshots, so trends are computed from created/cancel dates).

const num = (v: unknown) => Number(v ?? 0);

export interface BillingOps {
  mrrMinor: number;
  arrMinor: number;
  funnel: {
    trialing: number;
    active: number;
    pastDue: number;
    canceled: number;
  };
  conversionRate: number; // active / (active + canceled), %
  newMrrByMonth: { month: string; mrrMinor: number }[];
  cancellationsByMonth: { month: string; count: number }[];
  pastDue: {
    workspaceId: string;
    name: string;
    planKey: string | null;
    periodEnd: Date | null;
  }[];
  recentEvents: {
    type: string;
    workspaceName: string | null;
    at: Date;
  }[];
}

export const EMPTY_BILLING: BillingOps = {
  mrrMinor: 0,
  arrMinor: 0,
  funnel: { trialing: 0, active: 0, pastDue: 0, canceled: 0 },
  conversionRate: 0,
  newMrrByMonth: [],
  cancellationsByMonth: [],
  pastDue: [],
  recentEvents: [],
};

export async function getBillingOps(): Promise<BillingOps> {
  const [scalars, newMrr, cancels, pastDue, events] = await Promise.all([
    sqlClient<
      {
        mrr: string;
        trialing: number;
        active: number;
        past_due: number;
        canceled: number;
      }[]
    >`
      select
        (select coalesce(sum(p.price_minor), 0)::bigint
           from subscriptions s join plans p on p.key = s.plan_key
           where s.status = 'active') as mrr,
        count(*) filter (where status = 'trialing')::int as trialing,
        count(*) filter (where status = 'active')::int as active,
        count(*) filter (where status = 'past_due')::int as past_due,
        count(*) filter (where status = 'canceled')::int as canceled
      from subscriptions`,
    sqlClient<{ month: string; mrr: string }[]>`
      select to_char(date_trunc('month', s.created_at), 'YYYY-MM') as month,
             coalesce(sum(p.price_minor), 0)::bigint as mrr
      from subscriptions s join plans p on p.key = s.plan_key
      where s.created_at > now() - interval '12 months'
      group by 1 order by 1`,
    sqlClient<{ month: string; n: number }[]>`
      select to_char(date_trunc('month', coalesce(cancel_at, updated_at)), 'YYYY-MM') as month,
             count(*)::int as n
      from subscriptions
      where status = 'canceled'
        and coalesce(cancel_at, updated_at) > now() - interval '12 months'
      group by 1 order by 1`,
    sqlClient<
      {
        ws: string;
        name: string;
        plan_key: string | null;
        period_end: string | null;
      }[]
    >`
      select w.id::text as ws, w.name, s.plan_key, s.current_period_end as period_end
      from subscriptions s join workspaces w on w.id = s.workspace_id
      where s.status = 'past_due'
      order by s.current_period_end nulls last
      limit 50`,
    sqlClient<{ type: string; at: string; name: string | null }[]>`
      select b.type, b.processed_at as at, w.name
      from billing_events b left join workspaces w on w.id = b.workspace_id
      order by b.processed_at desc
      limit 20`,
  ]);

  const s = scalars[0];
  const active = num(s?.active);
  const canceled = num(s?.canceled);
  const mrrMinor = num(s?.mrr);
  const conversionRate =
    active + canceled > 0
      ? Math.round((active / (active + canceled)) * 100)
      : 0;

  return {
    mrrMinor,
    arrMinor: mrrMinor * 12,
    funnel: {
      trialing: num(s?.trialing),
      active,
      pastDue: num(s?.past_due),
      canceled,
    },
    conversionRate,
    newMrrByMonth: newMrr.map((r) => ({
      month: r.month,
      mrrMinor: num(r.mrr),
    })),
    cancellationsByMonth: cancels.map((r) => ({
      month: r.month,
      count: num(r.n),
    })),
    pastDue: pastDue.map((r) => ({
      workspaceId: r.ws,
      name: r.name,
      planKey: r.plan_key,
      periodEnd: r.period_end ? new Date(r.period_end) : null,
    })),
    recentEvents: events.map((r) => ({
      type: r.type,
      workspaceName: r.name,
      at: new Date(r.at),
    })),
  };
}
