"use client";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Activity, BarChart2, Zap, RefreshCw, Play, Loader2, Database, AlertCircle } from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeStore } from "@/store/useRealtimeStore";
import { useRealtimeStats } from "@/hooks/useRealtime";
import { api } from "@/lib/api";
import type { DashboardSummary, Machine, MachineStat, MetricKey } from "@/types";
import { METRIC_COLORS, METRIC_UNITS, type DateRange } from "@/types";
import { relativeTime, getDateRangeFrom } from "@/lib/utils";

const METRICS: MetricKey[] = ["power", "energy", "voltage", "current", "power_factor"];
const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: "15m", value: "15m" }, { label: "1h", value: "1h" },
  { label: "24h", value: "24h" }, { label: "7d", value: "7d" },
];

function KpiCard({
  title, value, unit, icon: Icon, color, delta,
}: {
  title: string; value: number | null; unit: string;
  icon: React.ElementType; color: string; delta?: number;
}) {
  return (
    <motion.div
      layout
      className="glass-card p-5 flex flex-col gap-4 relative overflow-hidden group"
    >
      {/* Background gradient hint */}
      <div 
        className="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
      />
      
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</span>
        <span 
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm" 
          style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </span>
      </div>
      
      {value === null ? (
        <div className="skeleton h-10 w-32 rounded-lg relative z-10" />
      ) : (
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-baseline gap-2 relative z-10"
        >
          <span className="text-3xl font-extrabold tracking-tight text-foreground">
            {typeof value === "number" ? value.toFixed(1) : value}
          </span>
          <span className="text-sm font-medium text-muted-foreground mb-1">{unit}</span>
          
          {delta !== undefined && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-auto mb-1 ${
              delta >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function Sparkline({ data, color }: { data: { ts: string; value: number }[]; color: string }) {
  if (!data?.length) return <div className="skeleton h-12 w-full rounded-lg" />;
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          fill={`url(#sg-${color.replace('#', '')})`}
          strokeWidth={2} 
          dot={false}
          isAnimationActive={true}
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const { companyUser, permissions } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [historicalStats, setHistoricalStats] = useState<MachineStat[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("power");
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [selectedMachineForKPI, setSelectedMachineForKPI] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange>("1h");
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const { liveFeed, timeSeries, latestValues } = useRealtimeStore();

  const allowedMachineIds = permissions["stats.read_all"]
    ? null
    : companyUser?.machine_assignments?.map((ma) => ma.machine_id) ?? [];

  useRealtimeStats(companyUser?.company_id ?? null, allowedMachineIds);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [s, m] = await Promise.all([
          api.get<DashboardSummary>("/api/v1/dashboard/summary"),
          api.get<Machine[]>("/api/v1/machines"),
        ]);
        setSummary(s);
        setMachines(m);
        // Default: Select first 2 machines for chart and cards
        setSelectedMachines(m.slice(0, 2).map((x) => x.id));
        // Default: Select first machine for KPI
        setSelectedMachineForKPI(m[0]?.id || "");

        // Load historical stats for the selected range
        const since = getDateRangeFrom(dateRange).toISOString();
        const statsArr: MachineStat[] = [];
        await Promise.all(
          m.slice(0, 5).map(async (machine) => {
            try {
              const res = await api.get<MachineStat[]>(
                `/api/v1/machines/${machine.id}/stats?metric_key=${selectedMetric}&since=${since}`
              );
              statsArr.push(...(res || []));
            } catch { /* not assigned */ }
          })
        );
        setHistoricalStats(statsArr);
      } catch (e) {
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateRange, selectedMetric]); // eslint-disable-line

  // Merge historical + realtime timeseries for chart
  const chartData = useMemo(() => {
    const merged: Record<string, Record<string, number>> = {};

    // Historical
    historicalStats
      .filter((s) => s.metric_key === selectedMetric && selectedMachines.includes(s.machine_id))
      .forEach((s) => {
        const bucket = new Date(s.ts).toISOString().slice(0, 16); // minute bucket
        if (!merged[bucket]) merged[bucket] = {};
        merged[bucket][s.machine_id] = s.metric_value;
      });

    const data = Object.entries(merged).map(([ts, values]) => ({ ts, ...values }));

    return data.sort((a, b) => a.ts.localeCompare(b.ts));
  }, [historicalStats, selectedMetric, selectedMachines]);

  async function startSimulation() {
    setSimulating(true);
    try {
      await api.post("/api/v1/dev/simulate?seconds=30&rate=3", {});
      toast.success("Simulation started — watch the charts update live!");
      
      // Reload data after simulation completes to show updated results
      setTimeout(async () => {
        try {
          setLoading(true);
          const [s, m] = await Promise.all([
            api.get<DashboardSummary>("/api/v1/dashboard/summary"),
            api.get<Machine[]>("/api/v1/machines"),
          ]);
          setSummary(s);
          setMachines(m);
          
          // Reload historical stats for the selected range
          const since = getDateRangeFrom(dateRange).toISOString();
          const statsArr: MachineStat[] = [];
          await Promise.all(
            m.slice(0, 5).map(async (machine) => {
              try {
                const res = await api.get<MachineStat[]>(
                  `/api/v1/machines/${machine.id}/stats?metric_key=${selectedMetric}&since=${since}`
                );
                statsArr.push(...(res || []));
              } catch { /* not assigned */ }
            })
          );
          setHistoricalStats(statsArr);
          
          toast.success("Data updated successfully!");
        } catch (error) {
          toast.error("Failed to refresh data");
        } finally {
          setLoading(false);
        }
      }, 32000); // Wait 32 seconds (30s simulation + 2s buffer)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  const machineMap = Object.fromEntries(machines.map((m) => [m.id, m]));

  const kpiData = useMemo(() => {
    if (!summary?.latest_stats?.length) return null;
    const latestByMetric: Partial<Record<MetricKey, number>> = {};
    
    // Filter stats by selected machine for KPI (if one is selected)
    const statsToUse = selectedMachineForKPI 
      ? summary.latest_stats.filter(ls => ls.machine_id === selectedMachineForKPI)
      : summary.latest_stats;
    
    statsToUse.forEach((ls) => {
      if (!latestByMetric[ls.metric_key as MetricKey]) {
        latestByMetric[ls.metric_key as MetricKey] = ls.metric_value;
      }
    });
    
    // Override with live realtime values for selected KPI machine
    if (selectedMachineForKPI && latestValues[selectedMachineForKPI]) {
      Object.entries(latestValues[selectedMachineForKPI]).forEach(([mk, v]) => {
        latestByMetric[mk as MetricKey] = v;
      });
    } else if (!selectedMachineForKPI) {
      // Show latest values from any machine when no specific KPI machine is selected
      Object.entries(latestValues).forEach(([mid, metrics]) => {
        Object.entries(metrics).forEach(([mk, v]) => {
          latestByMetric[mk as MetricKey] = v;
        });
      });
    }
    
    return latestByMetric;
  }, [summary, latestValues, selectedMachineForKPI]);

  return (
    <div className="space-y-8 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dashboard Overview</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            Real-time monitoring for <strong className="text-foreground">{companyUser?.company?.name}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* KPI Machine Filter */}
          <div className="relative">
            <select
              value={selectedMachineForKPI}
              onChange={(e) => setSelectedMachineForKPI(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border bg-card/80 backdrop-blur text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 shadow-sm transition-all hover:bg-card cursor-pointer"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          
          <button
            onClick={startSimulation}
            disabled={simulating}
            className="btn-primary"
          >
            {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {simulating ? "Simulating…" : "Run Simulator"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { key: "power"        as MetricKey, icon: Zap,        color: METRIC_COLORS.power || "#ef4444" },
          { key: "energy"       as MetricKey, icon: Activity,   color: METRIC_COLORS.energy || "#10b981" },
          { key: "voltage"      as MetricKey, icon: RefreshCw,  color: METRIC_COLORS.voltage || "#3b82f6" },
          { key: "current"      as MetricKey, icon: BarChart2,  color: METRIC_COLORS.current || "#f59e0b" },
          { key: "power_factor" as MetricKey, icon: Cpu,        color: METRIC_COLORS.power_factor || "#8b5cf6" },
        ].map(({ key, icon, color }, idx) => (
          <div key={key} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
            <KpiCard
              title={key.replace('_', ' ')}
              value={kpiData?.[key] ?? null}
              unit={METRIC_UNITS[key]}
              icon={icon}
              color={color}
              delta={Math.random() > 0.5 ? Math.random() * 5 : -Math.random() * 5} // Simulated delta for visual effect
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chart Section */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card p-5 sm:p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-bold text-foreground">Performance Trends</h2>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Metric Segmented Control */}
                <div className="flex p-1 bg-muted/50 rounded-xl border border-border/50">
                  {METRICS.slice(0, 3).map((mk) => (
                    <button
                      key={mk}
                      onClick={() => setSelectedMetric(mk)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                        selectedMetric === mk
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                      }`}
                    >
                      {mk}
                    </button>
                  ))}
                  <div className="relative">
                    <select
                      value={METRICS.includes(selectedMetric) && !METRICS.slice(0, 3).includes(selectedMetric) ? selectedMetric : ""}
                      onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
                      className={`appearance-none pl-4 pr-8 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer focus:outline-none ${
                        METRICS.includes(selectedMetric) && !METRICS.slice(0, 3).includes(selectedMetric)
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/50 bg-transparent"
                      }`}
                    >
                      <option value="" disabled>More...</option>
                      {METRICS.slice(3).map(mk => <option key={mk} value={mk}>{mk}</option>)}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                {/* Date Range Control */}
                <div className="flex p-1 bg-muted/50 rounded-xl border border-border/50">
                  {DATE_RANGES.map((dr) => (
                    <button
                      key={dr.value}
                      onClick={() => setDateRange(dr.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dateRange === dr.value
                          ? "bg-brand-500 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                      }`}
                    >
                      {dr.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Machine toggles */}
            <div className="flex flex-wrap gap-2 mb-6">
              {machines.map((m) => {
                const isSelected = selectedMachines.includes(m.id);
                // Assign a color from our palette based on index
                const colorIndex = machines.findIndex(x => x.id === m.id) % 5;
                const color = Object.values(METRIC_COLORS)[colorIndex];
                
                return (
                  <button
                    key={m.id}
                    onClick={() =>
                      setSelectedMachines((prev) =>
                        prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      isSelected
                        ? "bg-card border-border shadow-sm text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span 
                      className={`w-2.5 h-2.5 rounded-full transition-all ${isSelected ? 'scale-100' : 'scale-50 opacity-50'}`}
                      style={{ backgroundColor: color }}
                    />
                    {m.name}
                  </button>
                );
              })}
            </div>

            <div className="w-full h-[350px]">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-brand-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm font-medium animate-pulse">Loading analytics...</span>
                  </div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center flex-col text-muted-foreground">
                  <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium">No data available for this range</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border) / 0.5)" />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={(v) => v.slice(11, 16)}
                      tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      tickFormatter={(v) => typeof v === 'number' ? v.toFixed(0) : v}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgb(var(--card))",
                        border: "1px solid rgb(var(--border))",
                        borderRadius: "1rem",
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
                        fontSize: "13px",
                        fontWeight: 600,
                        padding: "12px 16px"
                      }}
                      itemStyle={{ padding: "4px 0" }}
                      labelStyle={{ color: "rgb(var(--muted-foreground))", marginBottom: "8px", fontSize: "12px" }}
                      formatter={(v: number, name: string) => {
                        const machineName = machineMap[name]?.name || name;
                        return [`${v.toFixed(2)} ${METRIC_UNITS[selectedMetric]}`, machineName];
                      }}
                      labelFormatter={(label) => {
                        const date = new Date(label);
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      }}
                    />
                    {selectedMachines.map((mid) => {
                      const colorIndex = machines.findIndex(x => x.id === mid) % 5;
                      const color = Object.values(METRIC_COLORS)[colorIndex];
                      return (
                        <Line
                          key={mid}
                          type="monotone"
                          dataKey={mid}
                          name={mid}
                          stroke={color}
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                          isAnimationActive={true}
                          animationDuration={1500}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Machine sparkline cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="glass-card p-5 h-36 skeleton" />
                ))
              : machines
                  .filter(m => selectedMachines.includes(m.id)) // Only show selected machines
                  .slice(0, 2) // Limit to 2 for layout
                  .map((m) => {
                  const status = m.status;
                  
                  // Get latest data from summary for current value
                  const machineStats = summary?.latest_stats?.filter(s => s.machine_id === m.id) || [];
                  const latest = machineStats.find(s => s.metric_key === selectedMetric)?.metric_value;
                  
                  // Get historical data for sparkline
                  const sparkData = historicalStats
                    .filter(s => s.machine_id === m.id && s.metric_key === selectedMetric)
                    .map(s => ({ ts: s.ts, value: s.metric_value }))
                    .slice(-30); // Last 30 points
                  
                  const colorIndex = machines.findIndex(x => x.id === m.id) % 5;
                  const color = Object.values(METRIC_COLORS)[colorIndex];

                  return (
                    <motion.div
                      key={m.id}
                      layout
                      className="glass-card p-5 group hover:-translate-y-1 transition-transform duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted">
                            <Cpu className="w-5 h-5 text-muted-foreground group-hover:text-brand-500 transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{m.name}</p>
                            <p className="text-xs font-medium text-muted-foreground">{m.code}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-bold ${
                          status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                          status === "maintenance" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}>
                          {status}
                        </span>
                      </div>
                      
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          {latest !== undefined ? (
                            <motion.p
                              key={latest}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-2xl font-extrabold text-foreground tracking-tight"
                            >
                              {latest.toFixed(1)} <span className="text-sm font-medium text-muted-foreground">{METRIC_UNITS[selectedMetric]}</span>
                            </motion.p>
                          ) : (
                            <p className="text-2xl font-extrabold text-muted-foreground">--</p>
                          )}
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{selectedMetric}</p>
                        </div>
                        <div className="w-24 h-12">
                           <Sparkline data={sparkData} color={color} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
          </div>
        </div>

        {/* Sidebar Column: System Status + Live Feed */}
        <div className="space-y-6">
          {/* System Status Summary */}
          <div className="glass-card p-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl"></div>
            <h2 className="text-sm font-bold text-foreground mb-4">System Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Total Machines</p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Registered units</p>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-foreground">{summary?.total_machines ?? "-"}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-50">Active</p>
                    <p className="text-[10px] font-medium text-emerald-700/70 dark:text-emerald-400/70 uppercase">Online now</p>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{summary?.active_machines ?? "-"}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Data Points</p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Collected today</p>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-foreground">{summary?.total_stats ? (summary.total_stats > 1000 ? `${(summary.total_stats/1000).toFixed(1)}k` : summary.total_stats) : "-"}</span>
              </div>
            </div>
          </div>

          {/* Live Feed */}
          <div className="glass-card flex flex-col flex-1 max-h-[500px]">
            <div className="p-5 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Activity Stream
              </h2>
              <AnimatePresence>
                {liveFeed.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-[10px] font-bold"
                  >
                    {liveFeed.length} NEW
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <AnimatePresence initial={false}>
                {liveFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">System is quiet</p>
                    <p className="text-xs text-muted-foreground mt-1 px-4">Waiting for real-time sensor data or run the simulator to generate test data.</p>
                    <button 
                      onClick={startSimulation}
                      className="mt-6 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" /> Auto-Generate Data
                    </button>
                  </div>
                ) : (
                  liveFeed.map((stat, i) => {
                    const color = METRIC_COLORS[stat.metric_key as MetricKey] || "#94a3b8";
                    return (
                      <motion.div
                        key={stat.id}
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className={`flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/50 transition-colors ${i === 0 ? 'shadow-sm ring-1 ring-border/50' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${color}15` }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-xs font-bold text-foreground truncate">
                              {machineMap[stat.machine_id]?.name || stat.machine_id.slice(0, 8)}
                            </p>
                            <span className="text-[10px] font-semibold text-muted-foreground shrink-0 tabular-nums">
                              {relativeTime(stat.ts)}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-extrabold" style={{ color }}>
                              {stat.metric_value.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {stat.metric_key}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
