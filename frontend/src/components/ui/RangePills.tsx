"use client";
import { motion } from "framer-motion";
import { useId } from "react";

/** Segmented time-range picker; the active highlight slides between options. */
export default function RangePills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-1.5" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative min-w-[44px] px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
              active
                ? "text-white border-transparent"
                : "bg-card text-navy-700 dark:text-navy-200 border-navy-300/70 dark:border-border hover:border-navy-500"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`range-pill-${id}`}
                className="absolute inset-0 rounded-md bg-navy-600 dark:bg-brand-500"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
