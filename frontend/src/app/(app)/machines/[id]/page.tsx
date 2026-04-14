"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Cpu, MapPin, Calendar, Users, Activity, TrendingUp, Building2, Plus, X, UserPlus, Package, Trash2, ChevronRight, BarChart2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { toast } from "sonner";
import { api } from "@/lib/api";
import CustomSelect from "@/components/ui/CustomSelect";
import { useAuth } from "@/contexts/AuthContext";
import type { Machine, MachineStat, CompanyUser, Module } from "@/types";
import { METRIC_COLORS, METRIC_UNITS, type DateRange, type MetricKey } from "@/types";
import { getDateRangeFrom } from "@/lib/utils";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: "15m", value: "15m" }, { label: "1h", value: "1h" },
  { label: "24h", value: "24h" }, { label: "7d", value: "7d" },
];

const STATUS_CLASSES = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  maintenance: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export default function MachineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { permissions } = useAuth();
  
  // Check if user has permission to manage assignments
  const canManageAssignments = permissions["machines.write"];
  const machineId = params.id as string;
  
  const [machine, setMachine] = useState<Machine | null>(null);
  const [stats, setStats] = useState<MachineStat[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<CompanyUser[]>([]);
  const [assignedModules, setAssignedModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<CompanyUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [userToUnassign, setUserToUnassign] = useState<CompanyUser | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);

  // Module assignment state
  const [showModuleAssignModal, setShowModuleAssignModal] = useState(false);
  const [availableModules, setAvailableModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [moduleAssignLoading, setModuleAssignLoading] = useState(false);
  const [showModuleUnassignModal, setShowModuleUnassignModal] = useState(false);
  const [moduleToUnassign, setModuleToUnassign] = useState<Module | null>(null);
  const [moduleUnassignLoading, setModuleUnassignLoading] = useState(false);

  // Metrics modal state
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [selectedModuleForMetrics, setSelectedModuleForMetrics] = useState<Module | null>(null);

  // Charts state
  const [dateRange, setDateRange] = useState<DateRange>("1h");
  const [selectedMetrics, setSelectedMetrics] = useState<Record<string, string[]>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [machineData, usersData, modulesData] = await Promise.all([
          api.get<Machine>(`/api/v1/machines/${machineId}`),
          api.get<CompanyUser[]>(`/api/v1/machines/${machineId}/users`),
          api.get<Module[]>(`/api/v1/machines/${machineId}/modules`)
        ]);

        setMachine(machineData);
        setAssignedUsers(usersData);
        setAssignedModules(modulesData);
        
        // Initialize selected metrics for all modules
        const initialSelectedMetrics: Record<string, string[]> = {};
        modulesData.forEach((module) => {
          const metricCodes = module.metrics?.map(m => m.code) || [];
          initialSelectedMetrics[module.id] = metricCodes;
        });
        setSelectedMetrics(initialSelectedMetrics);
      } catch (error) {
        console.error("Failed to load machine data:", error);
        toast.error("Failed to load machine data");
        router.push("/machines");
      } finally {
        setLoading(false);
      }
    }

    if (machineId) {
      loadData();
    }
  }, [machineId, router]);

  useEffect(() => {
    async function loadStats() {
      if (!machineId) return;
      setStatsLoading(true);
      try {
        const since = getDateRangeFrom(dateRange).toISOString();
        const until = new Date().toISOString();
        const statsData = await api.get<MachineStat[]>(`/api/v1/machines/${machineId}/stats?since=${since}&until=${until}`);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [machineId, dateRange]);

  const moduleChartDataMap = useMemo(() => {
    const dataMap: Record<string, any[]> = {};

    assignedModules.forEach((module) => {
      const merged: Record<string, Record<string, number>> = {};

      module.metrics?.forEach((metric) => {
        const metricKey = metric.code.toLowerCase();
        stats
          .filter((s) => s.metric_key === metricKey)
          .forEach((s) => {
            const timeKey = new Date(s.ts).toISOString();
            if (!merged[timeKey]) merged[timeKey] = {};
            merged[timeKey][metric.code] = s.metric_value;
          });
      });

      dataMap[module.id] = Object.entries(merged)
        .map(([ts, vals]) => ({ ts, ...vals }))
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    });

    return dataMap;
  }, [assignedModules, stats]);

  const loadAvailableUsers = async () => {
    try {
      const usersData = await api.get<CompanyUser[]>("/api/v1/users");
      // Filter out already assigned users
      const available = usersData.filter(user => 
        !assignedUsers.some(assigned => assigned.id === user.id)
      );
      setAvailableUsers(available);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setAssignLoading(true);
    try {
      await api.post(`/api/v1/machines/${machineId}/users`, { user_id: selectedUserId });
      toast.success("User assigned to machine successfully");
      setShowAssignModal(false);
      setSelectedUserId("");
      // Reload assigned users
      const usersData = await api.get<CompanyUser[]>(`/api/v1/machines/${machineId}/users`);
      setAssignedUsers(usersData);
    } catch (error) {
      console.error("Failed to assign user:", error);
      toast.error("Failed to assign user to machine");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignUser = async (user: CompanyUser) => {
    setUserToUnassign(user);
    setShowUnassignModal(true);
  };

  const confirmUnassignUser = async () => {
    if (!userToUnassign) return;

    setUnassignLoading(true);
    try {
      await api.delete(`/api/v1/machines/${machineId}/users/${userToUnassign.id}`);
      toast.success("User unassigned successfully");
      setShowUnassignModal(false);
      setUserToUnassign(null);
      // Reload assigned users
      const usersData = await api.get<CompanyUser[]>(`/api/v1/machines/${machineId}/users`);
      setAssignedUsers(usersData);
    } catch (error) {
      console.error("Failed to unassign user:", error);
      toast.error("Failed to unassign user");
    } finally {
      setUnassignLoading(false);
    }
  };

  const openAssignModal = () => {
    loadAvailableUsers();
    setShowAssignModal(true);
  };

  // Module assignment handlers
  const loadAvailableModules = async () => {
    try {
      const modulesData = await api.get<Module[]>("/api/v1/modules/active");
      const available = modulesData.filter(mod =>
        !assignedModules.some(assigned => assigned.id === mod.id)
      );
      setAvailableModules(available);
    } catch (error) {
      console.error("Failed to load modules:", error);
      toast.error("Failed to load modules");
    }
  };

  const handleAssignModule = async () => {
    if (!selectedModuleId) {
      toast.error("Please select a module");
      return;
    }

    setModuleAssignLoading(true);
    try {
      await api.post(`/api/v1/machines/${machineId}/modules`, { module_id: selectedModuleId });
      toast.success("Module assigned to machine successfully");
      setShowModuleAssignModal(false);
      setSelectedModuleId("");
      const modulesData = await api.get<Module[]>(`/api/v1/machines/${machineId}/modules`);
      setAssignedModules(modulesData);
    } catch (error) {
      console.error("Failed to assign module:", error);
      toast.error("Failed to assign module to machine");
    } finally {
      setModuleAssignLoading(false);
    }
  };

  const handleUnassignModule = async (module: Module) => {
    setModuleToUnassign(module);
    setShowModuleUnassignModal(true);
  };

  const confirmUnassignModule = async () => {
    if (!moduleToUnassign) return;

    setModuleUnassignLoading(true);
    try {
      await api.delete(`/api/v1/machines/${machineId}/modules/${moduleToUnassign.id}`);
      toast.success("Module unassigned successfully");
      setShowModuleUnassignModal(false);
      setModuleToUnassign(null);
      const modulesData = await api.get<Module[]>(`/api/v1/machines/${machineId}/modules`);
      setAssignedModules(modulesData);
    } catch (error) {
      console.error("Failed to unassign module:", error);
      toast.error("Failed to unassign module");
    } finally {
      setModuleUnassignLoading(false);
    }
  };

  const openModuleAssignModal = () => {
    loadAvailableModules();
    setShowModuleAssignModal(true);
  };

  const handleViewMetrics = (module: Module) => {
    setSelectedModuleForMetrics(module);
    setShowMetricsModal(true);
  };

  if (loading) {
    return (
      <EnergyPulseLoader fullScreen text="Loading machine data..." />
    );
  }

  if (!machine) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Cpu className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Machine not found</h3>
          <p className="text-sm text-muted-foreground">The requested machine could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <button
          onClick={() => router.back()}
          className="p-2.5 bg-card hover:bg-muted border border-border/50 rounded-xl transition-all shadow-sm hover:shadow"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3 tracking-tight">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/25 border border-brand-400/20">
              <Cpu className="w-7 h-7 text-white" />
            </div>
            {machine.name}
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">Comprehensive Machine Analysis and Statistics</p>
        </div>
      </motion.div>

      {/* Machine Info Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/60 shadow-lg shadow-brand-500/5"
      >
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-border/50 backdrop-blur-sm">
              <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-xl text-brand-600 dark:text-brand-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Machine Code</label>
                <p className="text-lg font-bold text-foreground font-mono">{machine.code}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-border/50 backdrop-blur-sm">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Location</label>
                <p className="text-lg font-bold text-foreground">{machine.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-border/50 backdrop-blur-sm">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Status</label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${STATUS_CLASSES[machine.status]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    machine.status === 'active' ? 'bg-emerald-500' : 
                    machine.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-500'
                  }`} />
                  {machine.status}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-border/50 backdrop-blur-sm">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Installation</label>
                <p className="text-lg font-bold text-foreground">
                  {machine.installation_date ? new Date(machine.installation_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Company Info for Superadmin */}
          {permissions["superadmin"] && machine.company && (
            <div className="mt-8 pt-6 border-t border-border/50">
              <div className="inline-flex items-center gap-4 p-3 pr-6 bg-muted/50 rounded-2xl border border-border/50">
                <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Operating Company</label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">{machine.company.name}</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-background rounded-md text-muted-foreground border border-border">@{machine.company.slug}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modules Section */}
          <div className="mt-8 pt-8 border-t border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                    <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  Monitoring Modules
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 ml-2">
                    {assignedModules.length} Active
                  </span>
                </h3>
                <p className="text-sm font-medium text-muted-foreground mt-4">
                  This machine doesn&apos;t have any monitoring modules assigned yet.
                </p>
              </div>
              {canManageAssignments && (
                <button
                  onClick={openModuleAssignModal}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-md shadow-brand-500/20 hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all font-bold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Assign Module
                </button>
              )}
            </div>

            {assignedModules.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedModules.map((module, idx) => {
                  const colorConfig: Record<string, { bgGlow: string, iconBg: string, iconBorder: string, text: string, hoverText: string }> = {
                    energy: { bgGlow: "bg-yellow-500/10 group-hover:bg-yellow-500/20", iconBg: "bg-yellow-500/10", iconBorder: "border-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400", hoverText: "group-hover:text-yellow-600 dark:group-hover:text-yellow-400" },
                    environmental: { bgGlow: "bg-emerald-500/10 group-hover:bg-emerald-500/20", iconBg: "bg-emerald-500/10", iconBorder: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400" },
                    vibration: { bgGlow: "bg-blue-500/10 group-hover:bg-blue-500/20", iconBg: "bg-blue-500/10", iconBorder: "border-blue-500/20", text: "text-blue-600 dark:text-blue-400", hoverText: "group-hover:text-blue-600 dark:group-hover:text-blue-400" },
                    prediction: { bgGlow: "bg-purple-500/10 group-hover:bg-purple-500/20", iconBg: "bg-purple-500/10", iconBorder: "border-purple-500/20", text: "text-purple-600 dark:text-purple-400", hoverText: "group-hover:text-purple-600 dark:group-hover:text-purple-400" },
                    safety: { bgGlow: "bg-red-500/10 group-hover:bg-red-500/20", iconBg: "bg-red-500/10", iconBorder: "border-red-500/20", text: "text-red-600 dark:text-red-400", hoverText: "group-hover:text-red-600 dark:group-hover:text-red-400" },
                  };
                  
                  const defaultColor = { bgGlow: "bg-brand-500/10 group-hover:bg-brand-500/20", iconBg: "bg-brand-500/10", iconBorder: "border-brand-500/20", text: "text-brand-600 dark:text-brand-400", hoverText: "group-hover:text-brand-600 dark:group-hover:text-brand-400" };
                  const colors = colorConfig[module.code.toLowerCase()] || defaultColor;
                  
                  return (
                    <motion.div
                      key={module.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`relative overflow-hidden flex flex-col p-5 rounded-2xl bg-card border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group`}
                    >
                      {/* Decorative background glow */}
                      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl transition-colors ${colors.bgGlow}`} />
                      
                      <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform duration-300 ${colors.iconBg} ${colors.iconBorder}`}>
                          <Activity className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        {canManageAssignments && (
                          <button
                            onClick={() => handleUnassignModule(module)}
                            className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                            title="Unassign module"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="relative z-10 flex-1">
                        <h4 className={`text-lg font-bold text-foreground transition-colors mb-1 ${colors.hoverText}`}>
                          {module.name}
                        </h4>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border/50 uppercase tracking-wider">
                            {module.code}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-4">
                          {module.description || `Monitoring features for ${module.name.toLowerCase()}.`}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between relative z-10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Metrics Count</span>
                          <span className={`text-sm font-extrabold ${colors.text}`}>
                            {module.metrics?.length || 0}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleViewMetrics(module)}
                          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 group/btn"
                        >
                          View Metrics <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-10 text-center border-dashed border-2 border-border">
                <div className="w-20 h-20 bg-brand-500/5 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-brand-500/10 shadow-inner">
                  <Package className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">No Modules Assigned</h4>
                <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto mb-6">
                  Enhance this machine&apos;s capabilities by assigning monitoring modules. They will appear here.
                </p>
                {canManageAssignments && (
                  <button
                    onClick={openModuleAssignModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-background hover:bg-muted border border-border rounded-xl font-bold text-sm text-foreground transition-all hover:shadow-md"
                  >
                    <Plus className="w-4 h-4 text-brand-500" />
                    Browse Available Modules
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Technical Specifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card overflow-hidden border border-border/60"
      >
        <div className="p-6 border-b border-border/50 bg-muted/20">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-brand-500" />
            Technical Specifications
          </h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {/* Equipment Information */}
          <div className="space-y-5">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border/50">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              Equipment Identity
            </h4>
            
            <div className="grid gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-brand-500 transition-colors">Type</label>
                <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors capitalize">{machine.equipment_type || "Unspecified"}</p>
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-brand-500 transition-colors">Manufacturer</label>
                <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.manufacturer || "Unspecified"}</p>
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-brand-500 transition-colors">Model No.</label>
                <p className="text-sm font-medium text-foreground font-mono bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.model_number || "Unspecified"}</p>
              </div>
            </div>
          </div>

          {/* Electrical Specifications */}
          <div className="space-y-5">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border/50">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Power Characteristics
            </h4>
            
            <div className="grid gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-amber-500 transition-colors">Rated Power</label>
                <div className="flex items-baseline gap-1 bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">
                  <span className="text-lg font-bold text-foreground">{machine.rated_power || 0}</span>
                  <span className="text-sm font-medium text-muted-foreground">kW</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-amber-500 transition-colors">Voltage</label>
                  <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.voltage_rating || "N/A"}</p>
                </div>
                <div className="group">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-amber-500 transition-colors">Phase</label>
                  <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.phase || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Energy Management */}
          <div className="space-y-5">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Performance Metrics
            </h4>
            
            <div className="grid gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-emerald-500 transition-colors">Meter ID</label>
                <p className="text-sm font-mono text-foreground bg-emerald-500/5 px-3 py-2 rounded-lg border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">{machine.energy_meter_id || "Unassigned"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-emerald-500 transition-colors">Baseline</label>
                  <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.baseline_consumption || "N/A"}</p>
                </div>
                <div className="group">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-emerald-500 transition-colors">Target</label>
                  <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.efficiency_target || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance & Monitoring */}
          <div className="space-y-5">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border/50">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Operational Stats
            </h4>
            
            <div className="grid gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-blue-500 transition-colors">Uptime</label>
                <div className="flex items-baseline gap-1 bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">
                  <span className="text-lg font-bold text-foreground">{machine.operating_hours || 0}</span>
                  <span className="text-sm font-medium text-muted-foreground">hrs/day</span>
                </div>
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-blue-500 transition-colors">Maintenance Cycle</label>
                <p className="text-sm font-medium text-foreground bg-muted/30 px-3 py-2 rounded-lg border border-transparent group-hover:border-border/50 transition-colors">{machine.maintenance_schedule || "Unscheduled"}</p>
              </div>
            </div>
          </div>

          {/* Branch Information */}
          {machine.branch && (
            <div className="space-y-5 lg:col-span-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Location Assignment
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 group-hover:text-purple-500 transition-colors">Branch Facility</label>
                  <div className="flex items-center gap-3 bg-muted/30 px-4 py-3 rounded-xl border border-transparent group-hover:border-border/50 transition-colors">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{machine.branch.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{machine.branch.code}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Total Readings</h3>
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.length}</p>
          <p className="text-sm text-muted-foreground">Data points collected</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Assigned Users</h3>
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">{assignedUsers.length}</p>
          <p className="text-sm text-muted-foreground">Users with access</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Latest Reading</h3>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.length > 0 ? stats[stats.length - 1].metric_value.toFixed(2) : "N/A"}
          </p>
          <p className="text-sm text-muted-foreground">
            {stats.length > 0 ? new Date(stats[stats.length - 1].ts).toLocaleString() : "No data"}
          </p>
        </div>
      </motion.div>

      {/* Assigned Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assigned Users ({assignedUsers.length})
            </h3>
            {canManageAssignments && (
              <button
                onClick={openAssignModal}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Assign User
              </button>
            )}
          </div>
        </div>
        
        {assignedUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No users assigned to this machine</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {assignedUsers.map((user, index) => (
              <div key={user.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                    user.status === "active"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                  }`}>
                    {user.status === "active" ? "Active" : "Inactive"}
                  </span>
                  {canManageAssignments && (
                    <button
                      onClick={() => handleUnassignUser(user)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Unassign user"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Module Charts Section */}
      <div className="space-y-6">
        {assignedModules.length === 0 ? (
          <div className="glass-card p-10 text-center border-dashed border-2 border-border">
            <BarChart2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">No Modules Assigned</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This machine has no monitoring modules assigned. Assign modules to view analytics charts.
            </p>
          </div>
        ) : (
          assignedModules.map((module: Module) => {
            const moduleColor = METRIC_COLORS[module.code.toLowerCase() as MetricKey] || "#6b7280";
            const moduleChartData = moduleChartDataMap[module.id] || [];
            const moduleSelectedMetrics = selectedMetrics[module.id] || module.metrics?.map(m => m.code) || [];

            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 sm:p-6 flex flex-col"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${moduleColor}15`, border: `1px solid ${moduleColor}30` }}>
                      <Package className="w-5 h-5" style={{ color: moduleColor }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{module.name} Monitoring</h2>
                      <p className="text-xs font-medium text-muted-foreground">{module.code}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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

                {/* Metric toggles */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {module.metrics?.map((metric, idx) => {
                    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
                    const color = colors[idx % colors.length];
                    const isSelected = moduleSelectedMetrics.includes(metric.code);

                    return (
                      <button
                        key={metric.id}
                        onClick={() => {
                          setSelectedMetrics(prev => ({
                            ...prev,
                            [module.id]: isSelected
                              ? prev[module.id]?.filter(m => m !== metric.code) || []
                              : [...(prev[module.id] || []), metric.code]
                          }));
                        }}
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
                        {metric.name}
                      </button>
                    );
                  })}
                </div>

                <div className="w-full h-[350px]">
                  {statsLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <EnergyPulseLoader text="Loading analytics..." />
                    </div>
                  ) : moduleChartData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center flex-col text-muted-foreground">
                      <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
                      <p className="font-medium">No data available for this module in the selected range</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border) / 0.5)" />
                        <XAxis
                          dataKey="ts"
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return dateRange === "24h" || dateRange === "7d" 
                              ? `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                              : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                          }}
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
                            const metric = module.metrics?.find(m => m.code === name);
                            return [v.toFixed(2), metric ? `${metric.name} (${metric.unit})` : name];
                          }}
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          iconType="circle"
                          wrapperStyle={{ fontSize: "12px", fontWeight: 600, color: "rgb(var(--foreground))" }}
                        />
                        {moduleSelectedMetrics.map((metricCode, idx) => {
                          const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
                          const color = colors[idx % colors.length];
                          const metric = module.metrics?.find(m => m.code === metricCode);
                          
                          return (
                            <Line
                              key={metricCode}
                              type="monotone"
                              dataKey={metricCode}
                              name={metric?.name || metricCode}
                              stroke={color}
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 6, fill: color, stroke: "rgb(var(--card))", strokeWidth: 2 }}
                              isAnimationActive={true}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Assign User Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Assign User to Machine</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">Select User</label>
                <CustomSelect
                  value={selectedUserId}
                  onChange={setSelectedUserId}
                  placeholder="Choose a user..."
                  options={availableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignUser}
                  disabled={assignLoading || !selectedUserId}
                  className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {assignLoading ? (
                    <>Assigning...</>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Assign User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unassign User Confirmation Modal */}
      {showUnassignModal && userToUnassign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Unassign User</h3>
                <button
                  onClick={() => setShowUnassignModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Are you sure you want to unassign this user from the machine?
                </p>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold">
                      {userToUnassign.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{userToUnassign.name}</p>
                    <p className="text-sm text-muted-foreground">{userToUnassign.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnassignModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUnassignUser}
                  disabled={unassignLoading}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {unassignLoading ? (
                    <>Unassigning...</>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Unassign User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Module Modal */}
      {showModuleAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Assign Module to Machine</h3>
                <button
                  onClick={() => setShowModuleAssignModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">Select Module</label>
                <CustomSelect
                  value={selectedModuleId}
                  onChange={setSelectedModuleId}
                  placeholder="Choose a module..."
                  options={availableModules.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModuleAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignModule}
                  disabled={moduleAssignLoading || !selectedModuleId}
                  className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {moduleAssignLoading ? (
                    <>Assigning...</>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Assign Module
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Module Confirmation Modal */}
      {showModuleUnassignModal && moduleToUnassign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Unassign Module</h3>
                <button
                  onClick={() => setShowModuleUnassignModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Are you sure you want to unassign this module from the machine?
                </p>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                    <Package className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{moduleToUnassign.name}</p>
                    <p className="text-sm text-muted-foreground">{moduleToUnassign.code}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModuleUnassignModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUnassignModule}
                  disabled={moduleUnassignLoading}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {moduleUnassignLoading ? (
                    <>Unassigning...</>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Unassign Module
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Metrics Modal */}
      {showMetricsModal && selectedModuleForMetrics && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Module Metrics</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedModuleForMetrics.name}</p>
                </div>
                <button
                  onClick={() => setShowMetricsModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {selectedModuleForMetrics.metrics && selectedModuleForMetrics.metrics.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedModuleForMetrics.metrics.map((metric, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                          <Activity className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{metric.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{metric.code}</p>
                        </div>
                      </div>
                      {metric.unit && (
                        <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded border border-border/50">
                          {metric.unit}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No metrics configured for this module</p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowMetricsModal(false)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
