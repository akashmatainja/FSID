"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Cpu, MapPin, Calendar, Users, Activity, TrendingUp, Building2, Loader2, Plus, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Machine, MachineStat, CompanyUser } from "@/types";

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
  const canManageAssignments = permissions["assignments.write"];
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
        console.log('Loading machine details for ID:', machineId);
        
        console.log('Fetching machine data...');
        const machineData = await api.get<Machine>(`/api/v1/machines/${machineId}`);
        console.log('Machine data loaded:', machineData);
        
        console.log('Fetching stats data...');
        const statsData = await api.get<MachineStat[]>(`/api/v1/machines/${machineId}/stats`);
        console.log('Stats data loaded:', statsData.length, 'stats');
        
        console.log('Fetching users data...');
        const usersData = await api.get<CompanyUser[]>(`/api/v1/machines/${machineId}/users`);
        console.log('Users data loaded:', usersData.length, 'users');
        
        setMachine(machineData);
        setStats(statsData);
        setAssignedUsers(usersData);
        console.log('All data loaded successfully');
      } catch (error) {
        console.error("Failed to load machine data:", error);
        console.error("Error details:", error instanceof Error ? error.message : error);
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
      toast.success("User assigned successfully");
      setShowAssignModal(false);
      setSelectedUserId("");
      // Reload assigned users
      const usersData = await api.get<CompanyUser[]>(`/api/v1/machines/${machineId}/users`);
      setAssignedUsers(usersData);
    } catch (error) {
      console.error("Failed to assign user:", error);
      toast.error("Failed to assign user");
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
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
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            {machine.name}
          </h1>
          <p className="text-sm text-muted-foreground">Machine Details and Statistics</p>
        </div>
      </div>

      {/* Machine Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Machine Code</label>
            <p className="text-lg font-semibold text-foreground font-mono">{machine.code}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
            <p className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {machine.location}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
            <span className={`text-sm px-3 py-1.5 rounded-full font-medium border ${STATUS_CLASSES[machine.status]}`}>
              {machine.status}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Created</label>
            <p className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(machine.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Company Info for Superadmin */}
        {permissions["superadmin"] && machine.company && (
          <div className="mt-6 pt-6 border-t border-border">
            <label className="block text-sm font-medium text-muted-foreground mb-1">Company</label>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{machine.company.name}</p>
                <p className="text-xs text-muted-foreground font-mono">@{machine.company.slug}</p>
              </div>
            </div>
          </div>
        )}
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
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
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
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Unassigning...
                    </>
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
