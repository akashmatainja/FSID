"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Cpu, Layers, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess, type ModuleAccess } from "@/components/providers/ModuleAccessProvider";
import { useRealtimeStore } from "@/store/useRealtimeStore";
import KpiTile from "@/components/ui/KpiTile";
import LivePill from "@/components/ui/LivePill";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import RankedBars from "@/components/charts/RankedBars";
import AlertsList from "@/components/alerts/AlertsList";
import { useAlerts, useOverview, usePredictiveHealth } from "@/hooks/useMonitoring";
import { useChartPalette, seriesColor } from "@/components/charts/palette";
import { pickPrimaryMetric } from "@/components/charts/moduleData";
import { api } from "@/lib/api";
import { relativeTime, formatDateTime } from "@/lib/utils";
import type { DashboardSummary, OverviewModule } from "@/types";

const STATUS: Record<string, string> = {
  active: "bg-emerald-500",
  maintenance: "bg-amber-500",
  inactive: "bg-slate-400",
};

/** Quantities that add up across machines (power, energy, flow); everything else is averaged. */
const isAdditive = (unit?: string) => /^(k?w|k?wh|mwh|l\/min|m3\/h|m³\/h)$/i.test((unit ?? "").trim());

export default function DashboardPage() {
  const { companyUser, permissions } = useAuth();
  const { machines, list, loading: accessLoading } = useModuleAccess();
  const { latestValues, isLive, lastUpdated } = useRealtimeStore();
  const palette = useChartPalette();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [simulating, setSimulating] = useState(false);
  const since24h = useMemo(() => new Date(Date.now() - 24 * 3600 * 1000), []);
  const { overview, unavailable: overviewUnavailable } = useOverview(since24h);
  const { alerts: openAlerts } = useAlerts({ status: "open", limit: 200 });
  const hasPredictive = list.some((a) => a.def.slug === "predictive");
  const { health } = usePredictiveHealth(since24h, hasPredictive);
  const alertsByMachine = useMemo(() => {
    const out: Record<string, { critical: number; warning: number }> = {};
    openAlerts.forEach((a) => {
      const v = (out[a.machine_id] ??= { critical: 0, warning: 0 });
      v[a.severity] += 1;
    });
    return out;
  }, [openAlerts]);

  const loadSummary = useCallback(() => {
    api.get<DashboardSummary>("/api/v1/dashboard/summary").then(setSummary).catch(() => toast.error("Failed to load dashboard"));
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  async function startSimulation() {
    setSimulating(true);
    try {
      await api.post("/api/v1/dev/simulate?seconds=30&rate=3", {});
      toast.success("Simulation started — watch the dashboard update live!");
      setTimeout(loadSummary, 32000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  const latestFor = useCallback((mid: string, key: string): number | null => {
    const live = latestValues[mid]?.[key];
    if (live !== undefined && live !== null) return live;
    const s = summary?.latest_stats?.find((ls) => ls.machine_id === mid && ls.metric_key === key);
    return s ? s.metric_value : null;
  }, [latestValues, summary]);

  /** Per module: headline aggregate of its primary metric + per-machine values. */
  const moduleStats = useMemo(() => list.map((acc) => {
    const primary = pickPrimaryMetric(acc.module.metrics, acc.def.primaryPrefer);
    const key = primary?.code.toLowerCase() ?? "";
    const rows = acc.machines
      .map((m) => ({ id: m.id, label: m.code || m.name, value: primary ? latestFor(m.id, key) : null }))
      .filter((r): r is { id: string; label: string; value: number } => r.value !== null);
    const additive = isAdditive(primary?.unit);
    const agg = rows.length ? (additive ? rows.reduce((a, r) => a + r.value, 0) : rows.reduce((a, r) => a + r.value, 0) / rows.length) : null;
    const base = { acc, primary, rows, agg, aggLabel: primary ? `${additive ? "Total" : "Avg"} ${primary.name.toLowerCase()}` : "No metrics", unit: primary?.unit, barMode: "load" as const };

    // Predictive: lead with the health score when it is configured
    const scored = acc.def.slug === "predictive" ? (health?.machines ?? []).filter((h) => h.score !== null) : [];
    if (scored.length) {
      return {
        ...base,
        rows: scored.map((h) => ({ id: h.machine_id, label: h.code || h.name, value: h.score as number })),
        agg: scored.reduce((a, h) => a + (h.score as number), 0) / scored.length,
        aggLabel: "Avg health score",
        unit: "/100",
        barMode: "health" as const,
      };
    }
    return base;
  }), [list, latestFor, health]);

  // Last time we heard from each machine
  const lastSeen = useMemo(() => {
    const out: Record<string, string> = {};
    summary?.latest_stats?.forEach((s) => { if (!out[s.machine_id] || s.ts > out[s.machine_id]) out[s.machine_id] = s.ts; });
    return out;
  }, [summary]);

  const machinesOnline = summary ? summary.active_machines : machines.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-800 dark:text-white">
            Plant overview
            {companyUser?.company?.name && (
              <>
                <span className="text-muted-foreground/60 mx-2">·</span>
                <span>{companyUser.company.name}</span>
              </>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <LivePill live={isLive} />
            {lastUpdated && <span className="text-xs text-muted-foreground">Updated {relativeTime(lastUpdated.toISOString())}</span>}
          </div>
        </div>
        {permissions["stats.write"] && (
          <button onClick={startSimulation} disabled={simulating} className="btn-secondary !px-3 !py-1.5 text-xs self-start sm:self-auto">
            <Play className="w-3.5 h-3.5" /> {simulating ? "Simulating…" : "Simulate data"}
          </button>
        )}
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile index={0} label="Machines online" value={summary || !accessLoading ? machinesOnline : null} unit={`/ ${summary?.total_machines ?? machines.length}`} color={palette.series[1]} />
        {moduleStats.map((ms, i) => (
          <KpiTile
            key={ms.acc.def.slug}
            index={i + 1}
            label={ms.barMode === "health" ? ms.aggLabel : `${ms.aggLabel} (now)`}
            value={ms.agg}
            unit={ms.unit}
            color={seriesColor(palette, [2, 0, 4][i] ?? i)}
          />
        ))}
        {!overviewUnavailable && (
          <KpiTile
            index={moduleStats.length + 1}
            label="Open alerts"
            value={overview ? overview.alerts.open : null}
            unit={overview && overview.alerts.critical > 0 ? `${overview.alerts.critical} critical` : undefined}
            color={palette.series[1]}
            status={overview ? (overview.alerts.critical > 0 ? "critical" : overview.alerts.open > 0 ? "warning" : null) : null}
          />
        )}
        <KpiTile index={moduleStats.length + 2} label="Data points" value={summary ? summary.total_stats : null} color={palette.series[5]} />
      </div>

      {/* Module cards */}
      {accessLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[260px]" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="glass-card p-10 text-center border-dashed">
          <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground mb-1">No monitoring modules yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Modules appear here once a machine you can monitor has Energy, Environmental or Predictive assigned.
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${list.length >= 3 ? "lg:grid-cols-3" : list.length === 2 ? "lg:grid-cols-2" : ""}`}>
          {moduleStats.map((ms, i) => (
            <ModuleCard key={ms.acc.def.slug} index={i} {...ms} overview={overview?.modules.find((o) => o.module_id === ms.acc.module.id)} />
          ))}
        </div>
      )}

      {/* Alerts across every module the user can access */}
      <AlertsList id="alerts" title="Alerts" showModule limit={10} />

      {/* Machine status */}
      <section className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="section-title">Machine status</h2>
          {permissions["machines.read"] || permissions["superadmin"] ? (
            <Link href="/machines" className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1">
              All machines <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>
        {machines.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 pb-6">{accessLoading ? "Loading…" : "No machines assigned to you."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="text-left border-y border-border bg-muted/50">
                  <th className="eyebrow px-5 py-2.5">Machine</th>
                  <th className="eyebrow px-3 py-2.5 hidden md:table-cell">Location</th>
                  <th className="eyebrow px-3 py-2.5">Status</th>
                  <th className="eyebrow px-3 py-2.5">Modules</th>
                  <th className="eyebrow px-3 py-2.5">Alerts</th>
                  <th className="eyebrow px-5 py-2.5 text-right">Last reading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {machines.slice(0, 10).map((m, idx) => {
                  const mods = list.filter((a) => a.machines.some((x) => x.id === m.id));
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className={alertsByMachine[m.id]?.critical ? "row-critical" : alertsByMachine[m.id]?.warning ? "row-warning" : ""}
                    >
                      <td className="px-5 py-3">
                        <Link href={`/machines/${m.id}`} className="flex items-center gap-3 group">
                          <span className="w-8 h-8 rounded-lg bg-navy-50 dark:bg-navy-900/60 text-navy-600 dark:text-navy-300 flex items-center justify-center shrink-0">
                            <Cpu className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">{m.name}</span>
                            <span className="block text-xs text-muted-foreground font-mono">{m.code}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden md:table-cell">{m.location || "—"}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize text-foreground">
                          <span className={`w-2 h-2 rounded-full ${STATUS[m.status] ?? "bg-slate-400"}`} />
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {mods.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {mods.map((a) => {
                            const MIcon = a.def.icon;
                            return (
                              <Link
                                key={a.def.slug}
                                href={`${a.def.href}?machine=${encodeURIComponent(m.code || m.id)}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-xs font-semibold text-foreground hover:border-brand-500/60 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                              >
                                <MIcon className="w-3 h-3" /> {a.def.navLabel}
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {alertsByMachine[m.id] ? (
                          <span className="inline-flex gap-1">
                            {alertsByMachine[m.id].critical > 0 && <span className="badge badge-danger !px-1.5 !py-0.5">{alertsByMachine[m.id].critical} crit</span>}
                            {alertsByMachine[m.id].warning > 0 && <span className="badge badge-warning !px-1.5 !py-0.5">{alertsByMachine[m.id].warning} warn</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground tabular whitespace-nowrap" title={lastSeen[m.id] ? relativeTime(lastSeen[m.id]) : undefined}>
                        {formatDateTime(lastSeen[m.id])}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ModuleCard({
  acc, primary, rows, agg, aggLabel, index, overview, unit, barMode,
}: {
  overview?: OverviewModule;
  unit?: string;
  barMode: "load" | "health";
  acc: ModuleAccess;
  primary: ReturnType<typeof pickPrimaryMetric>;
  rows: { id: string; label: string; value: number }[];
  agg: number | null;
  aggLabel: string;
  index: number;
}) {
  const { def, machines } = acc;
  const Icon = def.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={def.href} className="glass-card p-5 flex flex-col h-full group hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <h3 className="section-title">{def.title}</h3>
              <p className="text-xs text-muted-foreground">{def.blurb}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all mt-1" />
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{aggLabel}</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              {agg === null ? (
                <span className="text-2xl font-extrabold text-muted-foreground">—</span>
              ) : (
                <AnimatedNumber value={agg} decimals={Math.abs(agg) >= 100 ? 0 : 1} className="text-[28px] leading-none font-extrabold tracking-tight text-foreground tabular" />
              )}
              {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground px-2 py-1 rounded-md bg-muted">
            {machines.length} machine{machines.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-5 pt-4 border-t border-border flex-1">
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            {barMode === "health" ? "Lowest health scores" : `Top machines by ${primary?.name.toLowerCase() ?? "reading"}`}
          </p>
          <RankedBars items={rows} unit={unit} limit={3} emptyText="Waiting for readings" mode={barMode} ascending={barMode === "health"} />
        </div>

        {overview && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              {overview.compliance === null ? "No limits set" : (
                <>In limits (24h) <b className="text-foreground tabular">{overview.compliance.toFixed(overview.compliance >= 99.95 ? 0 : 1)}%</b></>
              )}
            </span>
            <span className={`inline-flex items-center gap-1 font-bold ${
              overview.critical > 0 ? "text-red-600 dark:text-red-400" : overview.warning > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {overview.open_alerts} open
            </span>
          </div>
        )}
      </Link>
    </motion.div>
  );
}
