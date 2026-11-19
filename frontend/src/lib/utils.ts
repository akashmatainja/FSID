import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMetricValue(value: number, metricKey: string): string {
  const units: Record<string, string> = {
    temperature: "°C",
    rpm: "RPM",
    vibration: "mm/s",
    energy: "kWh",
    pressure: "bar",
  };
  const unit = units[metricKey] || "";
  return `${value.toFixed(2)} ${unit}`.trim();
}

export function getDateRangeFrom(range: string): Date {
  const now = new Date();
  switch (range) {
    case "15m": return new Date(now.getTime() - 15 * 60 * 1000);
    case "1h":  return new Date(now.getTime() - 60 * 60 * 1000);
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    default:    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Standard date-time for tables, in the viewer's local time: "19 Nov 2026 11:30:50" (24-hour).
 * The CSV export (backend/handlers/logs.go, csvTimeLayout) uses the same format.
 */
export function formatDateTime(ts: string | number | Date | null | undefined): string {
  if (ts === null || ts === undefined || ts === "") return "—";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
