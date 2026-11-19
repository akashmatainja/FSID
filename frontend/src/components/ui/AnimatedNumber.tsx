"use client";
import { useEffect, useRef } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

/** Counts smoothly from the previous value to the new one. */
export default function AnimatedNumber({
  value,
  decimals = 1,
  duration = 0.8,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const first = useRef(true);
  const text = useTransform(mv, (v) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  );

  useEffect(() => {
    // Count up from zero on mount, then glide between later values.
    const from = first.current ? 0 : mv.get();
    first.current = false;
    mv.set(from);
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
