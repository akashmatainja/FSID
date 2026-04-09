"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Cpu, MapPin, Calendar, Users, Activity, TrendingUp, Building2, Plus, X, UserPlus, Package } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Machine, MachineStat, CompanyUser, Module } from "@/types";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";

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
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<CompanyUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [userToUnassign, setUserToUnassign] = useState<CompanyUser | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [machineData, statsData, usersData] = await Promise.all([
          api.get<Machine>(`/api/v1/machines/${machineId}`),
          api.get<MachineStat[]>(`/api/v1/machines/${machineId}/stats`),
          api.get<CompanyUser[]>(`/api/v1/machines/${machineId}/users`)
        ]);
        
        setMachine(machineData);
        setStats(statsData);
        setAssignedUsers(usersData);
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
          <div className="mt-8 pt-6 border-t border-border/50">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-500" />
              Monitoring Modules
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {machine.modules && machine.modules.length > 0 ? (
                machine.modules.map((module, idx) => (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/50 backdrop-blur-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                      <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{module.name}</p>
                      <p className="text-xs text-muted-foreground">{module.code} - {module.unit}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      module.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                        : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                    }`}>
                      {module.status}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8">
                  <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-border/50">
                    <Package className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No monitoring modules assigned</p>
                  <p className="text-xs text-muted-foreground mt-1">This machine doesn&apos;t have any monitoring modules configured</p>
                </div>
              )}
            </div>
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
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Choose a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
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
    </div>
  );
}
