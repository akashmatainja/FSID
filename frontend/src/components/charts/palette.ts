"use client";
import { useTheme } from "@/components/providers/ThemeProvider";

/** Series colours, in order. Dark variants are lifted for contrast on navy. */
const LIGHT = {
  series: ["#2f6ca3", "#17a397", "#e0a030", "#d64a3c", "#7c5cbf", "#4b9fd5"],
  grid: "#e3e9f1",
  axis: "#7b8ba1",
  threshold: "#d64a3c",
  reference: "#94a3b8",
  surface: "#ffffff",
  ink: "#1b2e47",
  muted: "#64748b",
  track: "#edf1f6",
};

const DARK = {
  series: ["#5b9bd8", "#2fc4b2", "#f0b445", "#ef6354", "#a48be0", "#7cc1ea"],
  grid: "#1c3048",
  axis: "#7f93ab",
  threshold: "#ef6354",
  reference: "#5d7590",
  surface: "#112133",
  ink: "#e2eaf3",
  muted: "#8a9eb6",
  track: "#1a2f47",
};

export type ChartPalette = typeof LIGHT;

export function useChartPalette(): ChartPalette {
  const { theme } = useTheme();
  return theme === "dark" ? DARK : LIGHT;
}

/** Accent colour for a KPI tile, cycling through the series palette. */
export function seriesColor(p: ChartPalette, i: number) {
  return p.series[i % p.series.length];
}
