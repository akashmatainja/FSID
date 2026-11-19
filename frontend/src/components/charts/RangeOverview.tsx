"use client";
import { motion } from "framer-motion";
import { useChartPalette, seriesColor } from "./palette";
import type { TrendPoint, TrendSeries } from "./TrendChart";

/**
 * Per-parameter min–max band over the selected range, with the average as a
 * tick and the latest value as a dot. Each row uses its own scale.
 */
export default function RangeOverview({ data, series }: { data: TrendPoint[]; series: TrendSeries[] }) {
  const p = useChartPalette();

  const rows = series.map((s, i) => {
    const vals = data.map((d) => d[s.key]).filter((v): v is number => typeof v === "number");
    if (!vals.length) return { s, i, empty: true as const };
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const last = vals[vals.length - 1];
    const span = max - min || Math.abs(max) || 1;
    const lo = min - span * 0.15, hi = max + span * 0.15;
    const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
    return { s, i, empty: false as const, min, max, avg, last, pos };
  });

  if (!rows.length) return <p className="text-sm text-muted-foreground py-10 text-center">No parameters selected</p>;

  const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 });

  return (
    <ul className="space-y-4">
      {rows.map((r, idx) => (
        <motion.li key={r.s.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <span className="w-2 h-2 rounded-full" style={{ background: seriesColor(p, r.i) }} />
              {r.s.name}
            </span>
            {!r.empty && (
              <span className="text-muted-foreground tabular">
                <span className="font-bold text-foreground">{f(r.last)}</span> {r.s.unit}
              </span>
            )}
          </div>
          {r.empty ? (
            <div className="h-2.5 rounded-full" style={{ background: p.track }} />
          ) : (
            <>
              <div className="relative h-2.5 rounded-full" style={{ background: p.track }}>
                <motion.div
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{ left: `${r.pos(r.min)}%`, background: seriesColor(p, r.i), opacity: 0.35 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${r.pos(r.max) - r.pos(r.min)}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                />
                <div className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded" style={{ left: `${r.pos(r.avg)}%`, background: p.ink, opacity: 0.5 }} title={`avg ${f(r.avg)}`} />
                <motion.div
                  className="absolute top-1/2 w-3 h-3 -mt-1.5 -ml-1.5 rounded-full border-2"
                  style={{ background: seriesColor(p, r.i), borderColor: p.surface }}
                  initial={{ left: `${r.pos(r.avg)}%` }}
                  animate={{ left: `${r.pos(r.last)}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  title={`latest ${f(r.last)}`}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1 tabular">
                <span>min {f(r.min)}</span>
                <span>avg {f(r.avg)}</span>
                <span>max {f(r.max)}</span>
              </div>
            </>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
