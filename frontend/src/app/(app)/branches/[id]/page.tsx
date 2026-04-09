"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Building2, Phone, Mail, Calendar, Users, Cpu, Settings, Edit, Trash2, AlertCircle, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import type { Branch, Machine, CompanyUser, Subdivision } from "@/types";

const STATUS_CLASSES = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  maintenance: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { permissions } = useAuth();
  const canWrite = permissions["branches.write"];
  const branchId = params.id as string;
  
  const [branch, setBranch] = useState<Branch | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadBranch() {
    setLoading(true);
    try {
      const branchData = await api.get<Branch>(`/api/v1/branches/${branchId}`);
      
      const [usersData, machinesData, subdivisionsData] = await Promise.all([
        api.get<CompanyUser[]>(`/api/v1/users?branch_id=${branchId}`),
        api.get<Machine[]>("/api/v1/machines").then(machines => 
          machines.filter(machine => machine.branch_id === branchId)
        ),
        api.get<Subdivision[]>("/api/v1/subdivisions").then(subdivisions => 
          subdivisions.filter(sub => sub.branch_id === branchId)
        )
      ]);
      
      setBranch(branchData);
      setMachines(machinesData);
      setUsers(usersData);
      setSubdivisions(subdivisionsData);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load branch details");
      router.push("/branches");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (branchId) {
      loadBranch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/api/v1/branches/${branchId}`);
      toast.success("Branch deleted successfully");
      router.push("/branches");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete branch");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return <EnergyPulseLoader text="Loading branch details..." />;
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Branch not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl border border-border/60 bg-card/50 hover:bg-background transition-all flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{branch.name}</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">Branch Management</p>
          </div>
        </div>
        
        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/branches/${branchId}/edit`)}
              className="w-10 h-10 rounded-xl border border-border/60 bg-card/50 hover:bg-background transition-all flex items-center justify-center"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-10 h-10 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center justify-center text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Branch Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
              <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Branch Information</h2>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Branch Code</p>
              <p className="text-sm font-bold text-foreground font-mono">{branch.code}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CLASSES[branch.status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  branch.status === 'active' ? 'bg-emerald-500' :
                  branch.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-500'
                }`}></span>
                {branch.status.toUpperCase()}
              </span>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</p>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">@{branch.company?.slug || "unknown"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Address</h2>
          </div>
          
          <div className="space-y-3">
            {branch.address && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Street Address</p>
                <p className="text-sm font-bold text-foreground">{branch.address}</p>
              </div>
            )}
            
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City, State</p>
              <p className="text-sm font-bold text-foreground">{branch.city}, {branch.state}</p>
            </div>
            
            {branch.pincode && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pincode</p>
                <p className="text-sm font-bold text-foreground">{branch.pincode}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Contact Information</h2>
          </div>
          
          <div className="space-y-3">
            {branch.phone && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{branch.phone}</p>
                </div>
              </div>
            )}
            
            {branch.email && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{branch.email}</p>
                </div>
              </div>
            )}
            
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">
                  {new Date(branch.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Machines</p>
              <p className="text-2xl font-bold text-foreground">{machines.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
              <Cpu className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Users</p>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Subdivisions</p>
              <p className="text-2xl font-bold text-foreground">{subdivisions.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <GitBranch className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Rate</p>
              <p className="text-2xl font-bold text-foreground">
                {machines.length > 0 
                  ? Math.round((machines.filter(m => m.status === 'active').length / machines.length) * 100)
                  : 0}%
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Machines List */}
      {machines.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Machines at this Branch</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Machine</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Power</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => (
                  <tr key={machine.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => router.push(`/machines/${machine.id}`)}
                        className="text-sm font-bold text-foreground hover:text-brand-600 transition-colors"
                      >
                        {machine.name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-muted-foreground">{machine.code}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">{machine.equipment_type || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">{machine.rated_power || 0} kW</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${STATUS_CLASSES[machine.status]}`}>
                        {machine.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative glass-card p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Branch</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete &quot;{branch.name}&quot;? This will also delete all equipment and data associated with this branch. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
