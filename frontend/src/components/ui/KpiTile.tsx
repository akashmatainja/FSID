"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";

/**
 * KPI tile with a coloured left edge: small uppercase label, big number, unit.
 * Briefly flashes its accent colour when a new live value arrives.
 */
export default function KpiTile({
  label,
  value,
  unit,
  color,
  delta,
  index = 0,
  status = null,
}: {
  label: string;
  value: number | null;
  unit?: string;
  color: string;
  delta?: number;
  index?: number;
  /** Limit breach: overrides the accent and shows a small badge. */
  status?: "critical" | "warning" | null;
}) {
  if (status === "critical") color = "#d64a3c";
  else if (status === "warning") color = "#e0a030";
  const [flash, setFlash] = useState(false);
  const prev = useRef<number | null>(value);

  useEffect(() => {
    if (value !== null && prev.current !== null && value !== prev.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  const decimals = value === null ? 0 : Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="glass-card card-accent px-4 py-3.5 pl-5 min-w-0"
      style={{ ["--accent-color" as string]: color }}
    >
      {/* live-update flash */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        initial={false}
        animate={{ opacity: flash ? 0.1 : 0 }}
        transition={{ duration: flash ? 0.1 : 0.5 }}
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate" title={label}>{label}</span>
        {status ? (
          <span className={`badge ${status === "critical" ? "badge-danger" : "badge-warning"} !px-1.5 !py-0.5 !text-xs animate-pulse-slow`}>
            {status === "critical" ? "Limit" : "Warn"}
          </span>
        ) : delta !== undefined && Number.isFinite(delta) && Math.abs(delta) >= 0.05 && (
          <span
            className={`inline-flex items-center text-xs font-bold tabular ${
              delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            }`}
          >
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 min-w-0">
        {value === null ? (
          <span className="skeleton h-8 w-20 inline-block" />
        ) : (
          <AnimatedNumber value={value} decimals={decimals} className="text-[28px] leading-none font-extrabold tracking-tight text-foreground tabular" />
        )}
        {unit && <span className="text-sm font-medium text-muted-foreground truncate">{unit}</span>}
      </div>
    </motion.div>
  );
}
