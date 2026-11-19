import type { Machine, MachineStat, Module, ModuleMetric } from "@/types";
import type { TrendPoint, TrendSeries, TrendThreshold } from "./TrendChart";

type LiveSeries = Record<string, { ts: string; value: number }[]>;

const DEFAULT_PREFER = [/^power$|^kw$|active_power/i, /power/i, /energy|kwh/i];

/** The metric that leads a module's chart: the first match in `prefer`, else the first metric. */
export function pickPrimaryMetric(metrics: ModuleMetric[] = [], prefer: RegExp[] = DEFAULT_PREFER): ModuleMetric | undefined {
  for (const re of prefer) {
    const hit = metrics.find((m) => re.test(m.code) || re.test(m.name) || re.test(m.unit ?? ""));
    if (hit) return hit;
  }
  return metrics[0];
}

/** Selected metrics as chart series, primary metric first. */
export function moduleSeries(module: Module, selectedCodes: string[], prefer?: RegExp[]): TrendSeries[] {
  const primary = pickPrimaryMetric(module.metrics, prefer);
  const chosen = (module.metrics ?? []).filter((m) => selectedCodes.includes(m.code));
  chosen.sort((a, b) => (a.id === primary?.id ? -1 : b.id === primary?.id ? 1 : 0));
  return chosen.map((m) => ({ key: m.code, name: m.name, unit: m.unit }));
}

/**
 * Merge a module's metrics into per-minute chart rows. Uses the live WebSocket
 * buffer when `live` is true, otherwise historical API stats.
 */
export function buildModuleChartData(
  module: Module,
  machineId: string,
  opts: { live: boolean; liveSeries?: LiveSeries; stats: MachineStat[] }
): TrendPoint[] {
  const merged: Record<string, Record<string, number>> = {};
  const put = (ts: string, code: string, v: number) => {
    const bucket = new Date(ts).toISOString().slice(0, 16);
    (merged[bucket] ??= {})[code] = v;
  };

  for (const metric of module.metrics ?? []) {
    const key = metric.code.toLowerCase();
    const live = opts.liveSeries?.[key];
    if (opts.live && live) {
      live.forEach(({ ts, value }) => put(ts, metric.code, value));
    } else {
      opts.stats
        .filter((s) => s.metric_key === key && s.machine_id === machineId)
        .forEach((s) => put(s.ts, metric.code, s.metric_value));
    }
  }

  return Object.entries(merged)
    .map(([ts, vals]) => ({ ts, ...vals }) as TrendPoint)
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

export type LimitStatus = "critical" | "warning" | null;

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Whether a value breaches the metric's configured limits. */
export function metricStatus(metric: ModuleMetric | undefined, value: number | null): LimitStatus {
  if (!metric || value === null) return null;
  if ((isNum(metric.crit_max) && value > metric.crit_max) || (isNum(metric.crit_min) && value < metric.crit_min)) return "critical";
  if ((isNum(metric.warn_max) && value > metric.warn_max) || (isNum(metric.warn_min) && value < metric.warn_min)) return "warning";
  return null;
}

export function hasLimits(metric: ModuleMetric | undefined) {
  return !!metric && [metric.warn_min, metric.warn_max, metric.crit_min, metric.crit_max].some(isNum);
}

/**
 * Reference line for the chart, in order of preference:
 *  1. the primary metric's configured upper limit (critical, else warning)
 *  2. the machine's rated power when the primary series is power
 *  3. the series average
 */
export function chartThreshold(
  machine: Machine | undefined,
  primary: TrendSeries | undefined,
  data: TrendPoint[],
  primaryMetric?: ModuleMetric
): TrendThreshold | null {
  if (!primary) return null;
  if (primaryMetric) {
    if (isNum(primaryMetric.crit_max)) return { value: primaryMetric.crit_max, label: "limit", kind: "limit" };
    if (isNum(primaryMetric.warn_max)) return { value: primaryMetric.warn_max, label: "warning", kind: "limit" };
    if (isNum(primaryMetric.crit_min)) return { value: primaryMetric.crit_min, label: "min limit", kind: "limit" };
    if (isNum(primaryMetric.warn_min)) return { value: primaryMetric.warn_min, label: "min warning", kind: "limit" };
  }
  const isPower = /power/i.test(primary.key) || primary.unit?.toLowerCase() === "kw";
  if (isPower && machine?.rated_power && machine.rated_power > 0) {
    return { value: machine.rated_power, label: "rated", kind: "limit" };
  }
  const vals = data.map((d) => d[primary.key]).filter((v): v is number => typeof v === "number");
  if (vals.length < 3) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { value: Number(avg.toFixed(2)), label: "avg", kind: "reference" };
}

/** % change of the latest value vs the previous reading in its series. */
export function seriesDelta(values: number[], latest: number | null): number | undefined {
  if (latest === null || !values.length) return undefined;
  const prevValues = values[values.length - 1] === latest ? values.slice(0, -1) : values;
  const prev = prevValues[prevValues.length - 1];
  if (prev === undefined || prev === 0) return undefined;
  return ((latest - prev) / prev) * 100;
}
