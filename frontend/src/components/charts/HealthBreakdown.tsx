"use client";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import type { MachineHealth } from "@/types";

/** "41 h", "3.2 days", "now"; null when not trending towards a limit. */
export function formatHoursToLimit(h: number | null | undefined): string | null {
  if (h === null || h === undefined) return null;
  if (h <= 0) return "now";
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(h < 240 ? 1 : 0)} days`;
}

export const healthColor = (score: number | null) =>
  score === null ? "rgb(var(--muted-foreground) / 0.5)" : score >= 80 ? "#17a397" : score >= 50 ? "#e0a030" : "#d64a3c";

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <span className="block h-1.5 w-20 rounded-full bg-muted overflow-hidden">
      <motion.span
        className="block h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(3, value * 100)}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </span>
  );
}

/**
 * Why a machine has its score: per metric, the three weighted factors
 * (condition 50 %, time out of limits 30 %, 24 h trend 20 %) and the
 * estimated time until the trend reaches the limit.
 */
export default function HealthBreakdown({ machine }: { machine: MachineHealth }) {
  const metrics = machine.metrics;
  if (!metrics.length) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          No predictive metric has limits yet. Set warning/critical limits (e.g. on vibration and temperature) on the
          Modules page to enable the health score.
        </p>
      </div>
    );
  }

  const stressColor = (v: number) => (v >= 0.8 ? "#d64a3c" : v >= 0.4 ? "#e0a030" : "#17a397");

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="data-table w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="eyebrow px-2 py-2">Metric</th>
            <th className="eyebrow px-2 py-2 text-right">Latest</th>
            <th className="eyebrow px-2 py-2" title="How close the latest reading is to its limits (50 % of the score)">Condition</th>
            <th className="eyebrow px-2 py-2 text-right" title="Share of readings outside limits in the window (30 %)">Out of limits</th>
            <th className="eyebrow px-2 py-2" title="Where the trend leads in 24 h (20 %)">Trend</th>
            <th className="eyebrow px-2 py-2 text-right">Time to limit</th>
            <th className="eyebrow px-2 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {metrics.map((m, i) => {
            const slope = m.slope_per_hour;
            const TrendIcon = slope === null || Math.abs(slope) < 1e-9 ? ArrowRight : slope > 0 ? ArrowUpRight : ArrowDownRight;
            const ttl = formatHoursToLimit(m.hours_to_limit);
            return (
              <motion.tr key={m.metric_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className={!m.has_data || m.score === null ? "" : m.score < 50 ? "row-critical" : m.score < 80 ? "row-warning" : ""}>
                <td className="px-2 py-2.5 font-semibold text-foreground whitespace-nowrap">{m.name}</td>
                {!m.has_data ? (
                  <td colSpan={6} className="px-2 py-2.5 text-xs text-muted-foreground">No readings in this window</td>
                ) : (
                  <>
                    <td className="px-2 py-2.5 text-right tabular whitespace-nowrap">
                      {m.latest?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="text-muted-foreground text-xs"> {m.unit}</span>
                    </td>
                    <td className="px-2 py-2.5"><Bar value={m.condition} color={stressColor(m.condition)} /></td>
                    <td className="px-2 py-2.5 text-right tabular">{m.out_of_limits_pct.toFixed(1)}%</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular whitespace-nowrap">
                        <TrendIcon className={`w-3.5 h-3.5 ${m.trend > 0 ? "text-amber-500" : ""}`} />
                        {slope === null ? "—" : `${slope >= 0 ? "+" : ""}${slope.toPrecision(2)}/h`}
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 text-right tabular whitespace-nowrap ${m.hours_to_limit !== null && m.hours_to_limit < 72 ? "cell-danger" : "text-muted-foreground"}`}>
                      {ttl ?? "stable"}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="inline-flex min-w-[36px] justify-center rounded px-1.5 py-0.5 text-xs font-extrabold text-white tabular" style={{ background: healthColor(m.score) }}>
                        {m.score}
                      </span>
                    </td>
                  </>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-3 px-1">
        Score = 100 × (1 − (0.5 · condition + 0.3 · out of limits + 0.2 · trend)). Machine score = 60 % worst metric + 40 % average,
        capped at 45 with an open critical alert and 75 with a warning. &ldquo;Time to limit&rdquo; extrapolates the current trend and is an estimate, not a failure prediction.
      </p>
    </div>
  );
}
