"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Colours chosen to read on both light and dark themes.
const INDIGO = "#6366f1";
const ROSE = "#f43f5e";
const gbp0 = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);

export function NewMrrChart({
  data,
}: {
  data: { month: string; mrrMinor: number }[];
}) {
  if (data.length === 0)
    return <Empty label="No new subscriptions in the last 12 months." />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INDIGO} stopOpacity={0.35} />
            <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          opacity={0.1}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => gbp0(Number(v))}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          formatter={(v) => [gbp0(Number(v)), "New MRR"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid rgba(128,128,128,0.3)",
          }}
        />
        <Area
          type="monotone"
          dataKey="mrrMinor"
          stroke={INDIGO}
          strokeWidth={2}
          fill="url(#mrrFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ChurnChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  if (data.length === 0)
    return <Empty label="No cancellations in the last 12 months." />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          opacity={0.1}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          formatter={(v) => [v, "Cancellations"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid rgba(128,128,128,0.3)",
          }}
        />
        <Bar dataKey="count" fill={ROSE} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
