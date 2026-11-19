"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Download, FileClock, RefreshCw, CalendarRange } from "lucide-react";
import { api } from "@/lib/api";
import { useModuleAccess } from "@/components/providers/ModuleAccessProvider";
import CustomSelect, { type SelectOption } from "@/components/ui/CustomSelect";
import RangePills from "@/components/ui/RangePills";
import AnimatedPagination from "@/components/ui/AnimatedPagination";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import type { ReadingLogPage, ReadingStatus } from "@/types";
import { formatDateTime } from "@/lib/utils";

type Preset = "1h" | "24h" | "7d" | "30d" | "custom";

const PRESETS: { label: string; value: Preset }[] = [
  { label: "1H", value: "1h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "Custom", value: "custom" },
];

const PRESET_MS: Record<Exclude<Preset, "custom">, number> = {
  "1h": 3600e3,
  "24h": 24 * 3600e3,
  "7d": 7 * 24 * 3600e3,
  "30d": 30 * 24 * 3600e3,
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All readings" },
  { value: "alarm", label: "Warning + critical" },
  { value: "critical", label: "Critical only" },
  { value: "warning", label: "Warning only" },
  { value: "normal", label: "Within limits" },
  { value: "no_limits", label: "No limits set" },
];

const STATUS_BADGE: Record<ReadingStatus, { cls: string; label: string }> = {
  critical: { cls: "badge-danger", label: "critical" },
  warning: { cls: "badge-warning", label: "warning" },
  normal: { cls: "badge-success", label: "normal" },
  no_limits: { cls: "bg-muted !text-muted-foreground", label: "no limits" },
  unknown: { cls: "bg-muted !text-muted-foreground", label: "—" },
};

const PAGE_SIZE = 50;

/** `<input type="datetime-local">` value (local time) for a Date. */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatValue(v: number) {
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium tabular focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50";

function LogsView() {
  const params = useSearchParams();
  const { machines, list: modules, loading: accessLoading } = useModuleAccess();

  const [preset, setPreset] = useState<Preset>("24h");
  const [customFrom, setCustomFrom] = useState(() => toLocalInput(new Date(Date.now() - 24 * 3600e3)));
  const [customTo, setCustomTo] = useState(() => toLocalInput(new Date()));
  const [machineId, setMachineId] = useState(params.get("machine_id") ?? "");
  const [moduleId, setModuleId] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [status, setStatus] = useState("all");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [data, setData] = useState<ReadingLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Filter options ────────────────────────────────────────────────────────
  const selectedModule = modules.find((m) => m.module.id === moduleId);

  const machineOptions = useMemo<SelectOption[]>(() => {
    const src = selectedModule ? selectedModule.machines : machines;
    return [{ value: "", label: "All machines" }, ...src.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))];
  }, [machines, selectedModule]);

  const moduleOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: "All modules" }, ...modules.map((m) => ({ value: m.module.id, label: m.module.name }))],
    [modules]
  );

  const metricOptions = useMemo<SelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const m of selectedModule ? [selectedModule] : modules) {
      for (const mt of m.module.metrics ?? []) {
        if (!seen.has(mt.code)) seen.set(mt.code, mt.unit ? `${mt.name} (${mt.unit})` : mt.name);
      }
    }
    return [{ value: "", label: "All metrics" }, ...Array.from(seen, ([value, label]) => ({ value, label }))];
  }, [modules, selectedModule]);

  // Drop selections that the new module filter makes impossible.
  useEffect(() => {
    if (machineId && !machineOptions.some((o) => o.value === machineId) && !accessLoading) setMachineId("");
    if (metricKey && !metricOptions.some((o) => o.value === metricKey)) setMetricKey("");
  }, [machineOptions, metricOptions, machineId, metricKey, accessLoading]);

  // ── Query ─────────────────────────────────────────────────────────────────
  const range = useMemo(() => {
    if (preset === "custom") {
      const from = new Date(customFrom);
      const to = new Date(customTo);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return { error: "Pick a valid start and end time." };
      if (from >= to) return { error: "Start time must be before end time." };
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const to = new Date();
    return { from: new Date(to.getTime() - PRESET_MS[preset]).toISOString(), to: to.toISOString() };
    // reloadTick re-anchors relative presets to "now"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, reloadTick]);

  const queryString = useMemo(() => {
    if ("error" in range) return null;
    const q = new URLSearchParams({ from: range.from!, to: range.to!, order });
    if (machineId) q.set("machine_id", machineId);
    if (moduleId) q.set("module_id", moduleId);
    if (metricKey) q.set("metric_key", metricKey);
    if (status !== "all") q.set("status", status);
    return q;
  }, [range, machineId, moduleId, metricKey, status, order]);

  // Any filter change goes back to page 1.
  useEffect(() => setPage(1), [queryString]);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    if (!queryString) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams(queryString);
      q.set("page", String(page));
      q.set("page_size", String(PAGE_SIZE));
      const res = await api.get<ReadingLogPage>(`/api/v1/logs/readings?${q}`);
      if (id === reqId.current) setData(res);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load logs");
      setData(null);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [queryString, page]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    if (!queryString) return;
    setExporting(true);
    setNotice(null);
    try {
      // Export timestamps in the viewer's timezone, matching the table.
      const q = new URLSearchParams(queryString);
      q.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      const { truncated } = await api.download(`/api/v1/logs/readings/export?${q}`, "readings.csv");
      if (truncated) setNotice("Export was limited to the first 100,000 readings. Narrow the time range or filters to get the rest.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const rangeError = "error" in range ? range.error : null;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Data Logs</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Browse and export recorded machine readings for any time period
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setReloadTick((t) => t + 1)} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={exportCsv} className="btn-primary" disabled={exporting || !queryString || !data?.total}>
            <Download className="w-4 h-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="glass-card p-5 space-y-4 relative z-20">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5" /> Time period
          </span>
          <RangePills value={preset} options={PRESETS} onChange={setPreset} />
        </div>

        {preset === "custom" && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">From</span>
              <input type="datetime-local" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">To</span>
              <input type="datetime-local" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className={inputCls} />
            </label>
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <CustomSelect value={moduleId} onChange={setModuleId} options={moduleOptions} placeholder="All modules" />
          <CustomSelect value={machineId} onChange={setMachineId} options={machineOptions} placeholder="All machines" />
          <CustomSelect value={metricKey} onChange={setMetricKey} options={metricOptions} placeholder="All metrics" />
          <CustomSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <CustomSelect
            value={order}
            onChange={(v) => setOrder(v as "asc" | "desc")}
            options={[
              { value: "desc", label: "Newest first" },
              { value: "asc", label: "Oldest first" },
            ]}
          />
        </div>

        {rangeError && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{rangeError}</p>}
        {notice && <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{notice}</p>}
      </section>

      {/* Results */}
      <section className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-b border-border/50">
          <h2 className="section-title">Readings</h2>
          {data && !error && (
            <p className="text-xs text-muted-foreground tabular">
              {data.total.toLocaleString()} reading{data.total === 1 ? "" : "s"} ·{" "}
              {formatDateTime(data.from)} – {formatDateTime(data.to)}
            </p>
          )}
        </div>

        {error ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : loading && !data ? (
          <EnergyPulseLoader text="Loading logs..." />
        ) : !data || data.items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <FileClock className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No readings in this period</h3>
            <p className="text-sm text-muted-foreground">Try a wider time range or fewer filters.</p>
          </div>
        ) : (
          <div className={`overflow-x-auto w-full transition-opacity ${loading ? "opacity-60" : ""}`}>
            <table className="data-table w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <th className="p-3 pl-6">Timestamp</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Metric</th>
                  <th className="p-3 text-right">Value</th>
                  <th className="p-3 pr-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 text-sm">
                {data.items.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.unknown;
                  return (
                    <tr key={r.id} className={r.status === "critical" ? "row-critical" : r.status === "warning" ? "row-warning" : ""}>
                      <td className="p-3 pl-6 tabular text-muted-foreground" title={r.ts}>
                        {formatDateTime(r.ts)}
                      </td>
                      <td className="p-3">
                        <Link href={`/machines/${r.machine_id}`} className="font-semibold text-foreground hover:text-brand-500">
                          {r.machine_name}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{r.machine_code}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.module_name ?? "—"}</td>
                      <td className="p-3">
                        <span className="text-foreground">{r.metric_name ?? r.metric_key}</span>
                        {r.metric_name && <span className="ml-2 text-xs text-muted-foreground font-mono">{r.metric_key}</span>}
                      </td>
                      <td className={`p-3 text-right tabular ${r.status === "critical" ? "cell-danger" : r.status === "warning" ? "cell-warning" : "text-foreground"}`}>
                        {formatValue(r.metric_value)}
                        {r.unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{r.unit}</span>}
                      </td>
                      <td className="p-3 pr-6">
                        <span className={`badge ${badge.cls} min-w-[104px]`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && totalPages > 1 && (
          <div className="flex justify-center border-t border-border/50 py-4">
            <AnimatedPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-[420px]" />}>
      <LogsView />
    </Suspense>
  );
}
