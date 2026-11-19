"use client";
import { useId, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Line,
} from "recharts";
import { History } from "lucide-react";
import { useChartPalette } from "./palette";
import { formatHoursToLimit } from "./HealthBreakdown";
import type { HealthHistoryPoint } from "@/types";

const BANDS = [
  { y1: 80, y2: 100, color: "#17a397", label: "good" },
  { y1: 50, y2: 80, color: "#e0a030", label: "watch" },
  { y1: 0, y2: 50, color: "#d64a3c", label: "critical" },
];

/**
 * Health score over time on a fixed 0–100 axis with good / watch / critical
 * bands behind it. For daily buckets a dashed line shows each day's lowest hour.
 */
export default function HealthHistoryChart({
  points,
  bucket,
  height = 240,
  loading = false,
}: {
  points: HealthHistoryPoint[];
  bucket: "hour" | "day";
  height?: number;
  loading?: boolean;
}) {
  const p = useChartPalette();
  const gid = useId().replace(/:/g, "");
  const data = useMemo(() => points.map((pt) => ({ ...pt, score: Math.round(pt.score * 10) / 10 })), [points]);

  if (loading) return <div className="skeleton w-full" style={{ height }} />;

  if (!data.length) {
    return (
      <div className="w-full flex flex-col items-center justify-center text-center text-muted-foreground" style={{ height }}>
        <History className="w-9 h-9 mb-2 opacity-30" />
        <p className="text-sm font-semibold text-foreground">No history yet</p>
        <p className="text-xs mt-1 max-w-xs">
          A snapshot is recorded every hour once this machine has a health score. The first point appears within 15 minutes.
        </p>
      </div>
    );
  }

  const fmtTick = (ts: string) => {
    const d = new Date(ts);
    return bucket === "day"
      ? d.toLocaleDateString([], { month: "short", day: "numeric" })
      : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", hour12: false }).replace(",", "");
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`${gid}-hfill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.series[0]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={p.series[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {BANDS.map((b) => (
            <ReferenceArea key={b.label} y1={b.y1} y2={b.y2} fill={b.color} fillOpacity={0.06} stroke="none" ifOverflow="hidden" />
          ))}
          <CartesianGrid stroke={p.grid} vertical={false} />
          <XAxis dataKey="ts" tickFormatter={fmtTick} tick={{ fontSize: 14, fill: p.axis }} axisLine={{ stroke: p.grid }} tickLine={false} minTickGap={40} dy={6} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 80, 100]} tick={{ fontSize: 14, fill: p.axis }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            cursor={{ stroke: p.axis, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const pt = payload[0].payload as HealthHistoryPoint;
              const ttl = formatHoursToLimit(pt.hours_to_limit);
              const color = pt.score >= 80 ? "#17a397" : pt.score >= 50 ? "#e0a030" : "#d64a3c";
              return (
                <div className="glass-card px-3.5 py-2.5 text-xs shadow-glass-lg min-w-[170px] space-y-1">
                  <p className="font-semibold text-muted-foreground">
                    {new Date(pt.ts).toLocaleString([], bucket === "day"
                      ? { weekday: "short", month: "short", day: "numeric" }
                      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{bucket === "day" ? "Avg score" : "Score"}</span>
                    <span className="text-base font-extrabold tabular" style={{ color }}>{pt.score.toFixed(0)}</span>
                  </p>
                  {bucket === "day" && (
                    <p className="flex justify-between gap-3"><span className="text-muted-foreground">Lowest hour</span><b className="tabular text-foreground">{pt.min_score}</b></p>
                  )}
                  <p className="flex justify-between gap-3"><span className="text-muted-foreground">Time to limit</span><b className="text-foreground">{ttl ?? "stable"}</b></p>
                  {(pt.open_critical > 0 || pt.open_warning > 0) && (
                    <p className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Open alerts</span>
                      <b className="text-foreground">{pt.open_critical > 0 ? `${pt.open_critical} crit ` : ""}{pt.open_warning > 0 ? `${pt.open_warning} warn` : ""}</b>
                    </p>
                  )}
                </div>
              );
            }}
          />
          {bucket === "day" && (
            <Line type="monotone" dataKey="min_score" stroke={p.threshold} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          )}
          <Area
            type="monotone"
            dataKey="score"
            stroke={p.series[0]}
            strokeWidth={2.25}
            fill={`url(#${gid}-hfill)`}
            dot={data.length < 40 ? { r: 2.5, fill: p.series[0], strokeWidth: 0 } : false}
            activeDot={{ r: 4.5, fill: p.series[0], stroke: p.surface, strokeWidth: 2 }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
