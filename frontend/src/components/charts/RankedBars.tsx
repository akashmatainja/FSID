"use client";
import { motion } from "framer-motion";
import { useChartPalette } from "./palette";

export interface RankedItem {
  id: string;
  label: string;
  value: number;
  highlight?: boolean;
}

/**
 * Horizontal ranked bars ("Consumption today" style). Bar colour reflects
 * share of the maximum: red ≥ 85 %, amber ≥ 50 %, otherwise teal.
 */
export default function RankedBars({
  items,
  unit,
  limit = 6,
  emptyText = "No readings yet",
  mode = "load",
  ascending = false,
}: {
  items: RankedItem[];
  unit?: string;
  limit?: number;
  emptyText?: string;
  /**
   * "load": colour by share of the max (high = red), e.g. consumption.
   * "health": fixed 0–100 scale, colour by score (high = green), e.g. health score.
   */
  mode?: "load" | "health";
  /** Sort lowest first (e.g. worst health on top). */
  ascending?: boolean;
}) {
  const p = useChartPalette();
  const rows = [...items].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit);
  const max = mode === "health" ? 100 : Math.max(...rows.map((r) => r.value), 0);

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{emptyText}</p>;
  }

  const colorFor = (v: number) => {
    if (mode === "health") return v >= 80 ? p.series[1] : v >= 50 ? p.series[2] : p.series[3];
    const share = max > 0 ? v / max : 0;
    return share >= 0.85 ? p.series[3] : share >= 0.5 ? p.series[2] : p.series[1];
  };

  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => {
        const pct = max > 0 ? Math.max(4, (r.value / max) * 100) : 0;
        return (
          <motion.li
            key={r.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="grid grid-cols-[minmax(0,88px)_1fr_auto] items-center gap-3"
          >
            <span
              className={`text-xs truncate ${r.highlight ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}
              title={r.label}
            >
              {r.label}
            </span>
            <span className="h-3 rounded-full overflow-hidden" style={{ background: p.track }}>
              <motion.span
                className="block h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: colorFor(r.value) }}
              />
            </span>
            <span className="text-xs font-bold text-foreground tabular text-right min-w-[48px]">
              {r.value.toLocaleString(undefined, { maximumFractionDigits: r.value >= 100 ? 0 : 1 })}
              {unit ? <span className="sr-only"> {unit}</span> : null}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
