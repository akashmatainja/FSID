"use client";
import { motion } from "framer-motion";
import type { OverviewMachineMetric, OverviewMetric } from "@/types";

/**
 * "Threshold status" panel: share of readings inside each metric's limits.
 * Green ≥ 99 %, amber ≥ 95 %, red below. Metrics without limits are listed
 * but greyed out.
 */
export default function ThresholdStatus({
  metrics,
  perMachine,
  machineId,
}: {
  metrics: OverviewMetric[];
  perMachine: OverviewMachineMetric[];
  /** Restrict to one machine; omit for all machines in the module. */
  machineId?: string;
}) {
  const rows = metrics.map((m) => {
    const hasLimit = [m.warn_min, m.warn_max, m.crit_min, m.crit_max].some((v) => v !== null && v !== undefined);
    let samples = m.samples, inLimits = m.in_limits;
    if (machineId) {
      const pm = perMachine.find((p) => p.metric_id === m.metric_id && p.machine_id === machineId);
      samples = pm?.samples ?? 0;
      inLimits = pm?.in_limits ?? 0;
    }
    const pct = hasLimit && samples > 0 ? (inLimits / samples) * 100 : null;
    return { m, hasLimit, pct, samples };
  });

  const color = (p: number) => (p >= 99 ? "#3f9b6a" : p >= 95 ? "#e0a030" : "#d64a3c");

  return (
    <ul className="space-y-3.5">
      {rows.map(({ m, hasLimit, pct, samples }, i) => (
        <motion.li
          key={m.metric_id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-3"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-foreground truncate" title={m.name}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pct === null ? "rgb(var(--muted-foreground) / 0.35)" : color(pct) }} />
            {m.name}
          </span>
          <span className="h-3 rounded-full overflow-hidden bg-muted">
            {pct !== null && (
              <motion.span
                className="block h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 2)}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: color(pct) }}
              />
            )}
          </span>
          <span className="text-xs font-bold tabular text-right min-w-[48px] text-foreground">
            {!hasLimit ? <span className="font-medium text-muted-foreground">no limit</span>
              : samples === 0 ? <span className="font-medium text-muted-foreground">no data</span>
              : `${pct!.toFixed(pct! >= 99.95 ? 0 : 1)}%`}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}
