"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Package, Trash2, ChevronDown, ChevronUp, Zap, Wind, Activity, Shield, Brain, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { GATEWAY_ENABLED } from "@/lib/features";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import type { Module, ModuleMetric } from "@/types";

const MODULE_ICONS: Record<string, React.ElementType> = {
  energy: Zap,
  environmental: Wind,
  prediction: Brain,
  // remote_maintenance: Activity, // Expert Guided Remote Maintenance moved to a separate site
};

const MODULE_COLORS: Record<string, string> = {
  energy:             "from-yellow-500/20 to-orange-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
  environmental:       "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  prediction:          "from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
  // Expert Guided Remote Maintenance moved to a separate site
  // remote_maintenance:  "from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
};

type LimitKey = "warn_min" | "warn_max" | "crit_min" | "crit_max";
type MetricForm = { name: string; code: string; unit: string; node_id: string } & Record<LimitKey, string>;

const EMPTY_FORM: MetricForm = { name: "", code: "", unit: "", node_id: "", warn_min: "", warn_max: "", crit_min: "", crit_max: "" };
const LIMIT_FIELDS: { key: LimitKey; label: string }[] = [
  { key: "crit_min", label: "Crit min" },
  { key: "warn_min", label: "Warn min" },
  { key: "warn_max", label: "Warn max" },
  { key: "crit_max", label: "Crit max" },
];

const formFromMetric = (m: ModuleMetric): MetricForm => ({
  name: m.name, code: m.code, unit: m.unit, node_id: m.node_id ?? "",
  warn_min: m.warn_min?.toString() ?? "", warn_max: m.warn_max?.toString() ?? "",
  crit_min: m.crit_min?.toString() ?? "", crit_max: m.crit_max?.toString() ?? "",
});

/** Form -> API payload; returns an error message when limits are out of order. */
function toPayload(f: MetricForm): { payload?: object; error?: string } {
  const limits = {} as Record<LimitKey, number | null>;
  for (const { key, label } of LIMIT_FIELDS) {
    const raw = f[key].trim();
    if (raw === "") { limits[key] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) return { error: `${label} must be a number` };
    limits[key] = n;
  }
  const order = LIMIT_FIELDS.map((x) => limits[x.key]);
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
    const a = order[i], b = order[j];
    if (a !== null && b !== null && a > b) return { error: `${LIMIT_FIELDS[i].label} must not exceed ${LIMIT_FIELDS[j].label}` };
  }
  return { payload: { name: f.name, code: f.code, unit: f.unit, node_id: f.node_id.trim(), limits } };
}

function limitSummary(m: ModuleMetric) {
  const u = m.unit ? ` ${m.unit}` : "";
  const side = (lo?: number | null, hi?: number | null) =>
    [lo != null ? `≥ ${lo}` : "", hi != null ? `≤ ${hi}` : ""].filter(Boolean).join(" · ");
  const parts: string[] = [];
  if (m.warn_min != null || m.warn_max != null) parts.push(`warn ${side(m.warn_min, m.warn_max)}${u}`);
  if (m.crit_min != null || m.crit_max != null) parts.push(`crit ${side(m.crit_min, m.crit_max)}${u}`);
  return parts;
}

function LimitInputs({ form, onChange }: { form: MetricForm; onChange: (f: MetricForm) => void }) {
  return (
    <div className="basis-full flex flex-wrap items-center gap-2 pt-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Alert limits</span>
      {LIMIT_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${key.startsWith("crit") ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>{label}</span>
          <input
            inputMode="decimal"
            value={form[key]}
            onChange={(e) => onChange({ ...form, [key]: e.target.value })}
            className="w-20 px-2 py-1 rounded-md border border-border bg-background text-xs tabular focus:outline-none"
            placeholder="—"
          />
        </label>
      ))}
      <span className="text-xs text-muted-foreground">Leave blank to skip. Order: crit min ≤ warn min ≤ warn max ≤ crit max.</span>
      {GATEWAY_ENABLED && (
      <label className="basis-full flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">OPC UA node template</span>
        <input
          value={form.node_id}
          onChange={(e) => onChange({ ...form, node_id: e.target.value })}
          className="flex-1 min-w-[260px] px-2 py-1 rounded-md border border-border bg-background text-xs font-mono focus:outline-none"
          placeholder="e.g. ns=2;s={machine_code}.Voltage"
        />
        <span className="text-xs text-muted-foreground basis-full">
          Placeholders: {"{machine_code}"}, {"{machine_name}"}, {"{metric_code}"}. Machines can override it on their own page. Empty = set per machine.
        </span>
      </label>
      )}
    </div>
  );
}

export default function ModulesPage() {
  const { permissions } = useAuth();
  const isSuperadmin = permissions["superadmin"];

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Metric form state
  const [addingMetricFor, setAddingMetricFor] = useState<string | null>(null);
  const [metricForm, setMetricForm] = useState<MetricForm>(EMPTY_FORM);
  const [savingMetric, setSavingMetric] = useState(false);
  const [editingMetric, setEditingMetric] = useState<ModuleMetric | null>(null);
  const [editMetricForm, setEditMetricForm] = useState<MetricForm>(EMPTY_FORM);
  const [deletingMetric, setDeletingMetric] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Module[]>("/api/v1/modules");
      setModules(data);
    } catch {
      toast.error("Failed to load modules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperadmin) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  const filtered = modules.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  );

  async function handleToggle(module: Module) {
    setToggling(module.id);
    try {
      const updated = await api.put<Module>(`/api/v1/modules/${module.id}/toggle`, { is_active: !module.is_active });
      setModules(prev => prev.map(m => m.id === module.id ? updated : m));
      toast.success(`${module.name} ${updated.is_active ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update module");
    } finally {
      setToggling(null);
    }
  }

  async function handleAddMetric(moduleId: string) {
    if (!metricForm.name || !metricForm.code) return;
    const { payload, error } = toPayload(metricForm);
    if (error) { toast.error(error); return; }
    setSavingMetric(true);
    try {
      const metric = await api.post<ModuleMetric>(`/api/v1/modules/${moduleId}/metrics`, payload);
      setModules(prev => prev.map(m => m.id === moduleId
        ? { ...m, metrics: [...(m.metrics || []), metric] }
        : m
      ));
      setMetricForm(EMPTY_FORM);
      setAddingMetricFor(null);
      toast.success("Metric added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add metric");
    } finally {
      setSavingMetric(false);
    }
  }

  async function handleUpdateMetric(moduleId: string) {
    if (!editingMetric) return;
    const { payload, error } = toPayload(editMetricForm);
    if (error) { toast.error(error); return; }
    setSavingMetric(true);
    try {
      const updated = await api.put<ModuleMetric>(`/api/v1/modules/${moduleId}/metrics/${editingMetric.id}`, payload);
      setModules(prev => prev.map(m => m.id === moduleId
        ? { ...m, metrics: (m.metrics || []).map(met => met.id === editingMetric.id ? updated : met) }
        : m
      ));
      setEditingMetric(null);
      toast.success("Metric updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update metric");
    } finally {
      setSavingMetric(false);
    }
  }

  async function handleDeleteMetric(moduleId: string, metricId: string) {
    setDeletingMetric(metricId);
    try {
      await api.delete(`/api/v1/modules/${moduleId}/metrics/${metricId}`);
      setModules(prev => prev.map(m => m.id === moduleId
        ? { ...m, metrics: (m.metrics || []).filter(met => met.id !== metricId) }
        : m
      ));
      toast.success("Metric removed");
    } catch {
      toast.error("Failed to remove metric");
    } finally {
      setDeletingMetric(null);
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Only superadmins can manage modules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Modules</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Activate or deactivate feature modules. Active modules are available for machine assignment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {modules.filter(m => m.is_active).length} Active
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            <span className="text-xs font-bold text-muted-foreground">
              {modules.filter(m => !m.is_active).length} Inactive
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all"
        />
      </div>

      {/* Modules List */}
      {loading ? (
        <EnergyPulseLoader text="Loading modules..." />
      ) : (
        <div className="space-y-4">
          {filtered.map((module, index) => {
            const Icon = MODULE_ICONS[module.code] || Package;
            const colorClass = MODULE_COLORS[module.code] || "from-brand-500/20 to-brand-400/10 border-brand-500/30 text-brand-600 dark:text-brand-400";
            const isExpanded = expandedModule === module.id;

            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className={`glass-card overflow-hidden transition-all duration-300 ${!module.is_active ? "opacity-60" : ""}`}
              >
                {/* Module Header Row */}
                <div className="flex items-center gap-4 p-5">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground text-base">{module.name}</h3>
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
                        {module.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        module.is_active
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}>
                        {module.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {module.metrics?.length || 0} metric{(module.metrics?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Explicit Toggle Button */}
                    <button
                      onClick={() => handleToggle(module)}
                      disabled={toggling === module.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-300 focus:outline-none border ${
                        module.is_active 
                          ? "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20 dark:text-rose-400" 
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400"
                      } disabled:opacity-50 shadow-sm`}
                      title={module.is_active ? "Deactivate module" : "Activate module"}
                    >
                      {toggling === module.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : module.is_active ? (
                        <><X className="w-3.5 h-3.5" /> Deactivate</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /> Activate</>
                      )}
                    </button>

                    {/* Expand metrics */}
                    <button
                      onClick={() => setExpandedModule(isExpanded ? null : module.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                        isExpanded 
                          ? "bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20" 
                          : "bg-card/50 border-border/60 hover:bg-background text-muted-foreground hover:text-foreground"
                      }`}
                      title="Manage metrics"
                    >
                      <span className="text-xs font-bold">Metrics</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Metrics Section */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/50 bg-muted/20 overflow-hidden"
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-foreground">Metrics</h4>
                          <button
                            onClick={() => { setAddingMetricFor(module.id); setMetricForm(EMPTY_FORM); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-bold transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Metric
                          </button>
                        </div>

                        {/* Existing Metrics */}
                        <div className="space-y-2">
                          {(module.metrics || []).length === 0 && addingMetricFor !== module.id && (
                            <p className="text-xs text-muted-foreground text-center py-4">No metrics yet. Add metrics to define what data this module collects.</p>
                          )}
                          {(module.metrics || []).map((metric) => (
                            <div key={metric.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card/60 border border-border/40 group">
                              {editingMetric?.id === metric.id ? (
                                <>
                                  <input
                                    value={editMetricForm.name}
                                    onChange={e => setEditMetricForm({ ...editMetricForm, name: e.target.value })}
                                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                                    placeholder="Name"
                                  />
                                  <input
                                    value={editMetricForm.code}
                                    onChange={e => setEditMetricForm({ ...editMetricForm, code: e.target.value })}
                                    className="w-28 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                                    placeholder="code"
                                  />
                                  <input
                                    value={editMetricForm.unit}
                                    onChange={e => setEditMetricForm({ ...editMetricForm, unit: e.target.value })}
                                    className="w-20 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                                    placeholder="Unit"
                                  />
                                  <button onClick={() => handleUpdateMetric(module.id)} disabled={savingMetric} className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 flex items-center justify-center transition-all">
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingMetric(null)} className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border/50 flex items-center justify-center transition-all">
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                  <LimitInputs form={editMetricForm} onChange={setEditMetricForm} />
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 min-w-0 text-sm font-semibold text-foreground">
                                    {metric.name}
                                    {limitSummary(metric).map((t) => (
                                      <span key={t} className={`ml-2 align-middle inline-flex px-1.5 py-0.5 rounded text-xs font-semibold tabular border ${t.startsWith("crit") ? "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5" : "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5"}`}>{t}</span>
                                    ))}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-muted text-muted-foreground border border-border/50">{metric.code}</span>
                                  <span className="w-14 text-xs font-medium text-muted-foreground text-right">{metric.unit || "—"}</span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { setEditingMetric(metric); setEditMetricForm(formFromMetric(metric)); }}
                                      className="w-7 h-7 rounded-lg hover:bg-muted border border-transparent hover:border-border/50 flex items-center justify-center transition-all"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMetric(module.id, metric.id)}
                                      disabled={deletingMetric === metric.id}
                                      className="w-7 h-7 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center justify-center transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Add Metric Row */}
                          <AnimatePresence>
                            {addingMetricFor === module.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-brand-500/5 border border-brand-500/20"
                              >
                                <input
                                  autoFocus
                                  value={metricForm.name}
                                  onChange={e => setMetricForm({ ...metricForm, name: e.target.value })}
                                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                                  placeholder="Metric name (e.g., Power)"
                                />
                                <input
                                  value={metricForm.code}
                                  onChange={e => setMetricForm({ ...metricForm, code: e.target.value })}
                                  className="w-28 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                                  placeholder="code"
                                />
                                <input
                                  value={metricForm.unit}
                                  onChange={e => setMetricForm({ ...metricForm, unit: e.target.value })}
                                  className="w-20 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                                  placeholder="Unit"
                                />
                                <button onClick={() => handleAddMetric(module.id)} disabled={savingMetric || !metricForm.name || !metricForm.code} className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 flex items-center justify-center transition-all disabled:opacity-50">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setAddingMetricFor(null)} className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border/50 flex items-center justify-center transition-all">
                                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <LimitInputs form={metricForm} onChange={setMetricForm} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
